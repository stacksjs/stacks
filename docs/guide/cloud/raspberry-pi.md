---
title: Deploying to a Raspberry Pi
description: "Deploy a Stacks application to a Linux box you already own, over SSH, with a Raspberry Pi profile for small single-board computers."
---
# Deploying to a Raspberry Pi

Stacks has three deploy targets. AWS goes through CloudFormation, Hetzner provisions a cloud
server through the Hetzner API, and `ssh` deploys to a Linux host you already own. The `ssh`
provider was built for a Raspberry Pi sitting on a desk, but it works for any 64-bit Debian or
Ubuntu host you can reach over SSH.

Nothing is provisioned through a provider API on this path. The host is adopted, checked and
bootstrapped in place, then deployed to exactly like the Hetzner box: a release tarball over SSH,
systemd units per site, and the rpx gateway in front.

## What you need

### Hardware

- A Raspberry Pi 5 is the target. A Pi 4 works.
- A Pi Zero, Pi 1 and Pi 2 will not work. Bun needs 64-bit ARMv8.
- An NVMe drive or an SSD is strongly preferred over an SD card. The box writes logs and a
  database continuously, and SD cards wear out under that load.
- Use the official 27W USB-C supply for a Pi 5. An underpowered supply shows up as random
  reboots and corrupted writes, not as a clear error.

### Operating system

You need a 64-bit image. 32-bit Raspberry Pi OS will not run Bun.

| Image | Boot volume on macOS | Notes |
|---|---|---|
| Raspberry Pi OS Trixie, the 2026-06-18 image or later | `/Volumes/bootfs` | Boots with cloud-init |
| Raspberry Pi OS Lite (64-bit), same release line | `/Volumes/bootfs` | Smallest useful image |
| Ubuntu Server 24.04 arm64 | `/Volumes/system-boot` | Boots with cloud-init |
| Ubuntu Server 26.04 arm64 | `/Volumes/system-boot` | Boots with cloud-init |

All four read `user-data`, `network-config` and `meta-data` from the boot partition. That is what
Stacks writes. The older `custom.toml` and `firstrun.sh` mechanism is legacy and is not what
Stacks writes, so an image that predates cloud-init will ignore the files and boot unconfigured.

If you prefer to customise the image with Raspberry Pi Imager instead, use Imager 2.0 or newer,
then skip to the doctor step below and let `buddy server:setup` do the rest.

### Network

- The Mac you deploy from must reach the board over SSH.
- On a home LAN the board is usually reachable by its mDNS name, for example `pi-stacks.local`.
- Nothing needs to be exposed to the internet for a LAN-only deploy. Going public is a separate,
  opt-in step described below.

## The five steps

```bash
buddy server:flash        # write the OS image to an SD card or USB disk
buddy server:first-boot   # write cloud-init files to the mounted boot partition
buddy server:doctor       # preflight the host over SSH
buddy server:setup        # adopt and bootstrap the host
buddy deploy --prod       # deploy, exactly as for Hetzner
```

On a LAN there is one optional extra: `buddy server:trust` teaches this machine to trust the
certificate authority the board signs its own HTTPS with. It is described under LAN access below.

### 1. Flash

```bash
buddy server:flash --list                              # which disks could be written to
buddy server:flash --os raspberry-pi-os-lite --dry-run # say what would happen
buddy server:flash --os raspberry-pi-os-lite --device /dev/disk4
```

| Option | Description |
|---|---|
| `--os <name>` | `raspberry-pi-os-lite` (default), `raspberry-pi-os`, `ubuntu-24.04`, `ubuntu-26.04` |
| `--device <path>` | The whole disk to write to, for example `/dev/disk4` |
| `--list` | List the disks that could be written to, and exit |
| `--dry-run` | Say what would happen without writing anything |
| `--yes` | Do not ask for confirmation before writing |
| `--verbose` | Verbose output |

The command reads the official image catalogue, downloads the image you pick, and writes it to a
block device. The catalogue is read at run time rather than pinned, because image URLs carry a
build date and a pinned link goes stale within months.

The download is not checksummed. A cached file is reused only when its size matches the size the
catalogue advertises, which catches a truncated download and nothing subtler. If you want the
guarantee, check the image against the `extract_sha256` in the catalogue yourself before writing,
or flash the card with Raspberry Pi Imager, which verifies what it writes.

The device allowlist refuses by default. An internal disk, a system image, or anything that is not
an ejectable whole disk is rejected with a reason rather than written to. Run `--list` first and
confirm the device before you accept it: the difference between the right device and the wrong one
is the difference between a prepared card and an erased laptop.

Two things stop the command rather than guessing. If the image you pick does not boot with
cloud-init, it says so; pick a current image, or flash it with Raspberry Pi Imager and start from
step 3. If `xz` is missing, it tells you to `brew install xz`, because the images ship as
`.img.xz`. Flashing is macOS-oriented; on Linux, write the image with `dd` and continue from
step 2.

### 2. First boot

Leave the card in the reader. macOS mounts the boot partition as `/Volumes/bootfs` for Raspberry
Pi OS and `/Volumes/system-boot` for Ubuntu.

```bash
buddy server:first-boot --hostname pi-stacks --user pi
```

This writes `user-data`, `network-config` and `meta-data` to the mounted boot partition.

| Option | Description |
|---|---|
| `--hostname <name>` | The name the board answers to on the network (default `pi-stacks`) |
| `--user <name>` | The login to create, which the deploy then uses (default `pi`) |
| `--ssh-key <path>` | Public key to authorise (default `~/.ssh/id_ed25519.pub`) |
| `--os <name>` | Which image was written, which decides the boot volume name |
| `--out <dir>` | Write the files here instead of the mounted boot partition |
| `--wifi-ssid <ssid>` | Join this wireless network on first boot |
| `--wifi-country <code>` | Two-letter regulatory domain, required with `--wifi-ssid` |
| `--timezone <tz>` | IANA timezone for the board |
| `--env <name>` | Environment whose configuration to bootstrap (default `production`) |
| `--force` | Overwrite first-boot files already on the card |

The wireless passphrase is never a flag. It is read from `WIFI_PASSWORD` or prompted for, so it
does not end up in your shell history or in the process list.

Those files create your login user, install your SSH public key, disable password authentication
(`ssh_pwauth: false`, and the account is created with `lock_passwd: true`), set the hostname, and
give that user passwordless sudo. Eject the card, put it in the board, and power it on. The first
boot takes a few minutes because cloud-init expands the filesystem and applies the configuration.

The instructions printed at the end come from ts-cloud and name its own CLI (`cloud ssh:preflight`,
`cloud deploy`). The `buddy` equivalents are the next two steps below, and they are what the rest of
this guide uses.

On Raspberry Pi OS Trixie some cloud-init modules can rerun on later boots
([raspberrypi/trixie-feedback#26](https://github.com/raspberrypi/trixie-feedback/issues/26)). The
Stacks bootstrap is idempotent and marks itself done, so a rerun changes nothing.

### 3. Doctor

```bash
buddy server:doctor                    # the host from config/cloud.ts
buddy server:doctor pi-spare.local     # or name one
buddy server:doctor --discover         # or browse the network for one
buddy server:doctor --json             # findings as JSON
```

This connects over SSH and checks the things that fail late and confusingly if you skip them:
architecture, OS release, memory, disk, sudo, clock and outbound HTTPS. Fix what it reports before
you go further. Nothing on the box has been changed at this point. The command exits non-zero when
a finding is an error, so it drops into CI as a gate.

`--discover` browses for `_ssh._tcp` over mDNS for a few seconds and takes the first host it hears.
It is macOS-only, and a board that has only just booted may not have announced itself yet, so it
supplements naming a host rather than replacing it. `--env <name>` picks the environment whose
configuration the host is checked against, and defaults to `production`.

### 4. Setup

```bash
buddy server:setup
buddy server:setup --dry-run   # run the checks and stop before changing anything
```

Setup adopts the host. It runs the same preflight first and refuses to touch a host that fails it.
Then it installs Bun, the rpx gateway and the systemd units if they are missing, and creates the
deploy staging directory. It takes the same `[host]`, `--env` and `--discover` arguments as the
doctor.

On the `raspberry-pi` profile it also applies small-board tuning: a 1 GB swap file rather than the
2 GB used elsewhere, and ARM-specific preflight findings (it reports the Pi model, and refuses a
32-bit userland outright, because Bun ships no 32-bit build).

Finally it records the host at `storage/cloud/state/<stackName>.json`: the address, SSH user and
port, the key path when one is configured, the profile, and the deploy staging path. Later deploys
read that file instead of rediscovering the host.

Setup is safe to run again. The bootstrap marks its own version on the box, so a second run
installs only what is missing.

Do not run setup for a project that uses `cloud.attachTo` (see [Several projects on one
board](#several-projects-on-one-board)). Provisioning refuses an attached project outright: the
project that owns the board runs setup, and the tenants only deploy.

### 5. Deploy

```bash
buddy deploy --prod
```

From here the workflow is the same as for the Hetzner box. Preview first if you want to see the
plan without changing anything:

```bash
buddy deploy --prod --dry-run
```

`--dry-run` is a global buddy flag rather than one `deploy` declares, and the deploy checks argv for
it directly, so a requested preview can never fall through into the real pipeline. The environment
flags `deploy` itself declares are `--prod`, `--staging` and `--dev` (`--dev`, not
`--development`), and you can also name the environment positionally: `buddy deploy production`.

The preview reports "Adopt SSH host" rather than "create a server", because nothing is created on
this path.

## Configuration

Add this to `config/cloud.ts`. It replaces the `cloud: { provider: 'hetzner' }` block.

```ts
export const tsCloud: TsCloudConfig = {
  project: {
    name: 'my-app',
    // Unique on the board. It names this project's rpx gateway fragment.
    slug: 'my-app',
    region: 'us-east-1',
  },

  stateDir: 'storage/cloud',

  cloud: {
    provider: 'ssh',
  },

  ssh: {
    // 'raspberry-pi' applies small-board tuning. 'generic' is the default.
    profile: 'raspberry-pi',

    // Exactly one host. The first entry with no role, or role 'app', is the
    // one deployed to, and provisioning refuses a list of more than one:
    // multi-host ssh fleets are not supported yet.
    hosts: [
      {
        host: 'pi-stacks.local',
        user: 'pi',
        port: 22,
        privateKeyPath: '~/.ssh/id_ed25519',
        role: 'app',
      },
    ],

    // 'pin' is the default: the host key is recorded the first time ts-cloud
    // connects, and a key that changes afterwards is refused. 'accept-new'
    // trusts the first key it sees. 'insecure' disables checking entirely.
    hostKey: 'pin',

    // Run privileged remote steps through sudo rather than as root.
    sudo: true,

    // Omit this to stay LAN-only. 'auto' discovers the public address at
    // deploy time. A literal address is used as given.
    // publicIp: 'auto',

    // The name the gateway holds a local certificate for, and whether it
    // issues one at all.
    lan: {
      hostname: 'pi-stacks.local',
      tls: 'local-ca',
    },
  },

  // ... environments, sites, infrastructure as before
}
```

### Environment overrides

Every connection detail can come from the environment instead. Environment beats config, so a CI
run or a one-off deploy can point at another board without editing `config/cloud.ts`.

| Variable | Overrides |
|---|---|
| `TS_CLOUD_SSH_HOST` | `ssh.hosts[].host` |
| `TS_CLOUD_SSH_USER` | `ssh.hosts[].user`, default `root` |
| `TS_CLOUD_SSH_PORT` | `ssh.hosts[].port`, default `22` |
| `TS_CLOUD_SSH_KEY` | `ssh.hosts[].privateKeyPath` |
| `TS_CLOUD_SSH_HOST_KEY` | `ssh.hostKey`, one of `pin`, `accept-new`, `insecure` |
| `TS_CLOUD_SSH_PROFILE` | `ssh.profile`, `raspberry-pi` or `generic` |
| `TS_CLOUD_SSH_PUBLISH_DNS` | `1` forces DNS publishing on, `0` forces it off |

If no host is configured and no `TS_CLOUD_SSH_HOST` is set, the deploy stops and tells you what to
write. That is a setup gap, not a failure worth a stack trace.

## LAN access

A deploy to a private address publishes no DNS, requests no Let's Encrypt certificate, skips the
CDN and skips mail reconciliation. It prints the LAN URLs instead.

That is deliberate. An A record pointing at `192.168.1.42` is not merely useless. It hands every
visitor's browser a name that resolves to whatever sits at that address on *their* network.
Let's Encrypt has the same problem from the other side: an ACME challenge cannot reach a host the
internet cannot route to.

An address counts as private when it is RFC1918 (`10/8`, `172.16/12`, `192.168/16`), CGNAT
(`100.64/10`), loopback, link-local, an IPv6 unique-local or link-local address, a `.local`,
`.localhost`, `.internal`, `.lan`, `.intranet` or `.home.arpa` name, or a bare single-label
hostname.

The deploy prints something like:

```
Private host: skipping DNS, TLS issuance, CDN and mail reconciliation.
Reachable on the local network at https://pi-stacks.local, http://pi-stacks.local:3000
```

The `https://` URL is the gateway. It answers on 443 for the hostname it holds a local certificate
for. The per-site `http://` URLs are listed too, because only one name resolves over mDNS, so a
second site is reachable by port until you give it a name your router or hosts file can resolve.

### Trusting the board's CA

With `lan: { tls: 'local-ca' }` the box runs its own certificate authority and signs the LAN
certificate itself. Nothing outside the box trusts that authority until you install it.

```bash
buddy server:trust
```

That reads the authority off the board over SSH, saves a copy at
`storage/cloud/ssh/<host>.ca.crt`, and installs it into this machine's trust store. Safari, Chrome
and `curl` then accept the LAN HTTPS URL without a warning. Installing needs `sudo`, so macOS asks
for your password: you type it into the system prompt, and buddy never handles it.

| Option | Description |
|---|---|
| `[host]` | The host to read from, instead of the one in `config/cloud.ts` |
| `--env <name>` | Environment whose configuration names the host (default `production`) |
| `--discover` | Browse the local network for hosts advertising SSH |
| `--ca-path <path>` | Where the authority lives on the host (default `/etc/rpx/local-ca/rpx-root-ca.crt`) |
| `--mobileconfig <path>` | Also write an Apple configuration profile for an iPhone or iPad |
| `--export-only` | Save the certificate without changing this machine, and print how to trust it by hand |
| `--json` | Print the result as JSON |

Nothing is created on the board. If there is no authority at the path, the command says so and
stops: that host is not serving LAN HTTPS from its own authority, which takes
`ssh: { lan: { tls: 'local-ca' } }` in `config/cloud.ts` and a deploy. A run against an already
trusted certificate reports that and changes nothing.

`--json` prints the host, the path on the board, the local copy, the certificate's SHA-256
fingerprint, whether this machine trusts it, and the profile path when one was written. The
certificate itself is never printed, by any of the output modes.

For an iPhone or an iPad, ask for a configuration profile:

```bash
buddy server:trust --mobileconfig ~/Desktop/pi-stacks.mobileconfig
```

AirDrop or mail it to the device, then:

1. Open the profile and install it under **Settings > General > VPN & Device Management**.
2. Go to **Settings > General > About > Certificate Trust Settings**.
3. Turn on full trust for the board's root certificate.

That third step is not optional on iOS. Installing the profile alone is not enough, and the symptom
of skipping it is a certificate warning that looks like the certificate is wrong.

Set `lan: { tls: 'off' }` if you would rather serve plain HTTP on the LAN and skip all of this.

## Going public

Once the host has a routable address and a site declares a domain, the `ssh` provider behaves
exactly like the Hetzner box. DNS records are published, a Let's Encrypt certificate is issued, and
the gateway serves the domain.

Three things have to be true:

1. **Forward ports 80 and 443 to the board** on your router. ACME's HTTP challenge arrives on 80,
   and visitors arrive on 443.
2. **Give a site a domain.** With no domain declared anywhere, nothing is published, because there
   is nothing to publish.
3. **Set `ssh.publicIp`.** Use `'auto'` to discover the address at deploy time, or write the
   address in. A private value here is treated as private, so a `publicIp` of `192.168.1.42`
   keeps the deploy LAN-only.

Set `TS_CLOUD_SSH_PUBLISH_DNS=1` when the board is behind a port forward whose public address the
deploy process cannot see. Set it to `0` to keep a routable host LAN-only anyway.

A residential connection usually has a dynamic address. Point the domain at a dynamic DNS name, or
re-run the deploy when the address changes, or ask your ISP for a static address.

## Several projects on one board

Multiple projects can share one Pi through `cloud.attachTo`, the same way tenants share a Hetzner
box. The owning project deploys normally. Each other project sets:

```ts
cloud: {
  provider: 'ssh',
  attachTo: 'my-app', // the owning project's slug
},
```

An attached project skips provisioning, resolves the existing box from `ssh.hosts` (there is no
provider API to ask), and deploys only its own sites. It must not run `buddy server:setup`:
provisioning refuses `cloud.attachTo` outright, because the board belongs to the owning project.

Each project owns `/etc/rpx/sites.d/<slug>.json`, and a deploy replaces that file wholesale. Two
consequences follow:

- **`project.slug` must be unique on the board.** A tenant whose slug equals the owner's slug is
  refused, because deploying would overwrite the owner's gateway fragment and take its sites down.
- **A project's fragment must list every domain that project serves.** If the file on the box
  serves domains the config no longer declares, the deploy stops and names them rather than
  silently dropping them. When you really are retiring a domain, list it in `cloud.retiredDomains`
  and the deploy will let it go.

Pick each site's port explicitly and check what is already bound (`ss -lntp` on the board) before
adding a tenant. Two tenants can bind the same port config-file-cleanly and collide at run time.

The environment file matters here too. Your `.env.<environment>` is decrypted at deploy time and
shipped as each site's `.env`, so anything in it reaches every site of that project. See
[Deploy](/guide/buddy/deploy) for the `tenants` list that strips another tenant's keys before
shipping.

## Troubleshooting

### The `.local` name does not resolve

mDNS is per-subnet and some networks block it.

- Check it resolves at all: `ping pi-stacks.local`.
- If it does not, find the board's address from your router's client list and use the address in
  `ssh.hosts[].host`, or add it to `/etc/hosts` on your Mac.
- A guest VLAN or client isolation on the access point will block mDNS. Move the board and the
  Mac to the same subnet.
- An address is still a private address, so the LAN rules above continue to apply.

### `Permission denied (publickey)`

- Confirm the key exists at the path you configured. A key named in config that is not on disk
  used to fail much later inside a remote command. The deploy now checks it up front and names
  the path.
- Confirm the key is the one cloud-init installed. `ssh -i ~/.ssh/id_ed25519 pi@pi-stacks.local`
  reproduces what the deploy does.
- Leave `privateKeyPath` unset to let `ssh` choose from your agent and `~/.ssh/config`. The deploy
  logs when it does that.
- Password authentication is disabled by the first-boot configuration. There is no password
  fallback by design.

### Passwordless sudo is missing

Remote steps that install packages and write systemd units run through sudo. If sudo prompts, the
deploy hangs or fails, because it runs with `BatchMode=yes` and no terminal.

`buddy server:doctor` reports this. To fix it by hand, on the board:

```bash
echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/ts-cloud
sudo chmod 440 /etc/sudoers.d/ts-cloud
```

That is the file the doctor's own remediation names, so a second run agrees with what you did.

Deploying as `root` avoids the issue entirely, at the cost of a root SSH login.

### The clock is wrong on first boot

A Raspberry Pi has no real-time clock. It boots believing it is whenever it last shut down, and
NTP takes a moment to correct that. In that window `apt` rejects repository metadata as not yet
valid, and ACME rejects the certificate request.

- `buddy server:doctor` checks the clock and says so.
- Wait a minute after first boot before running setup.
- To force it: `sudo timedatectl set-ntp true` then `timedatectl status` on the board.

### SD card wear

Symptoms are a filesystem that remounts read-only, a database that reports corruption, or services
that fail to start after a reboot that used to work.

- Move to an NVMe drive or a USB SSD. This is the single biggest reliability change you can make.
- Cap the journal, which is the largest routine writer. The SSH bootstrap does not do this for you,
  so on the board: `sudo journalctl --vacuum-size=256M --vacuum-time=14d`, and write
  `SystemMaxUse=256M` under `[Journal]` in `/etc/systemd/journald.conf.d/99-retention.conf` to keep
  it that way.
- Keep backups off the board. See the deploy warning about managed services with no offsite backup
  destination.

### A service does not come back after a reboot

Work through this in order, on the board:

```bash
systemctl list-units --failed          # what did not start
systemctl status <site>.service        # why
journalctl -u <site>.service -n 200    # the last 200 lines
systemctl is-enabled <site>.service    # enabled means it starts at boot
```

Then check the gateway and the disk:

```bash
systemctl status rpx-gateway           # the unit is rpx-gateway.service
cat /etc/rpx/sites.d/<slug>.json
df -h                                  # a full disk stops everything quietly
```

If the unit is running but nothing answers, the port is the usual cause. Confirm what is bound
with `ss -lntp` and compare it against the site's configured port. If the unit is not enabled, it
started from a deploy but was never wired into boot: re-run `buddy deploy --prod`, which installs
and enables the units.

## Where the state lives

- `storage/cloud/state/<stackName>.json` on your machine pins this host: its address, SSH user and
  port, the key path when one is configured, the profile and the deploy staging path. `server:setup`
  and each deploy add to that record rather than replacing it, so the host key fingerprint ts-cloud
  pinned on the first connection, the address the board reports on your network, and which bootstrap
  version ran are all kept.
- `storage/cloud/ssh/<host>.ca.crt` on your machine is the copy of the board's certificate
  authority that `buddy server:trust` saves. Under `hostKey: 'pin'` ts-cloud also keeps the host
  key it recorded, in a `known_hosts` file of its own.
- `/var/ts-cloud/staging` on the board is the deploy staging path.
- `/var/lib/ts-cloud/bootstrap.v<n>` on the board is the marker that makes the bootstrap idempotent.
- `/etc/rpx/sites.d/<slug>.json` on the board is this project's gateway fragment.

`buddy cloud` lists the fleet for an `ssh` project from the config and those pins. There is no
provider API to enumerate, so a host is in the list because your config or a previous deploy names
it, and its status reads `unknown`. Nothing polls these hosts. `buddy server:doctor` is what
actually asks.

## Related

- [Deploy](/guide/cloud/deployment) - the three deploy targets and how `cloud.provider` selects
- [buddy deploy](/guide/buddy/deploy) - every flag on the deploy command
- [Extend Cloud](/guide/cloud/extend) - custom infrastructure
