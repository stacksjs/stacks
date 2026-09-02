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

The command reads the official image catalogue, downloads the image you pick, verifies its
checksum, and writes it to a block device. The catalogue is read at run time rather than pinned,
because image URLs carry a build date and a pinned link goes stale within months.

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

Those files create your login user, install your SSH public key, disable password authentication,
set the hostname, and enable passwordless sudo for that user. Eject the card, put it in the board,
and power it on. The first boot takes a few minutes because cloud-init expands the filesystem and
applies the configuration.

On Raspberry Pi OS Trixie some cloud-init modules can rerun on later boots
([raspberrypi/trixie-feedback#26](https://github.com/raspberrypi/trixie-feedback/issues/26)). The
Stacks bootstrap is idempotent and marks itself done, so a rerun changes nothing.

### 3. Doctor

```bash
buddy server:doctor
```

This connects over SSH and checks the things that fail late and confusingly if you skip them:
architecture, OS release, memory, disk, sudo, clock and outbound HTTPS. Fix what it reports before
you go further. Nothing on the box has been changed at this point.

### 4. Setup

```bash
buddy server:setup
```

Setup adopts the host. It installs Bun, the rpx gateway and the systemd units if they are missing,
creates the deploy staging directory, and records the host key fingerprint so later deploys pin it.
On the `raspberry-pi` profile it also applies small-board tuning: a smaller swap file, capped
journald retention, and ARM-specific checks.

Setup is safe to run again. It installs only what is missing.

### 5. Deploy

```bash
buddy deploy --prod
```

From here the workflow is the same as for the Hetzner box. Preview first if you want to see the
plan without changing anything:

```bash
buddy deploy --prod --dry-run
```

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

    // The first host with no role, or role 'app', is the one deployed to.
    hosts: [
      {
        host: 'pi-stacks.local',
        user: 'pi',
        port: 22,
        privateKeyPath: '~/.ssh/id_ed25519',
        role: 'app',
      },
    ],

    // 'pin' is the default: refuse a host key that does not match the pin
    // recorded at setup. 'accept-new' trusts the first key it sees.
    // 'insecure' disables host key checking entirely.
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
`.internal`, `.lan`, `.intranet` or `.home.arpa` name, or a bare single-label hostname.

The deploy prints something like:

```
Private host: skipping DNS, TLS issuance, CDN and mail reconciliation.
Reachable on the local network at https://pi-stacks.local, http://pi-stacks.local:3000
```

The `https://` URL is the gateway. It answers on 443 for the hostname it holds a local certificate
for. The per-site `http://` URLs are listed too, because only one name resolves over mDNS, so a
second site is reachable by port until you give it a name your router or hosts file can resolve.

### Trusting the board's CA

With `lan: { tls: 'local-ca' }` the box runs its own certificate authority (rpx `localCa`) and
signs the LAN certificate itself. Nothing outside the box trusts that CA until you install it.

```bash
buddy server:trust
```

On the Mac you run it from, this installs the board's CA certificate into the system keychain.
Safari, Chrome and `curl` then accept the LAN HTTPS URL without a warning.

For an iPhone or an iPad, `buddy server:trust` can emit a `.mobileconfig` profile instead. AirDrop
or email it to the device, then:

1. Open the profile and install it under **Settings > General > VPN & Device Management**.
2. Go to **Settings > General > About > Certificate Trust Settings**.
3. Turn on full trust for the board's root certificate.

That second step is not optional on iOS. Installing the profile alone is not enough, and the
symptom of skipping it is a certificate warning that looks like the certificate is wrong.

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

An attached project skips provisioning, resolves the existing box, and deploys only its own sites.

Each project owns `/etc/rpx/sites.d/<slug>.json`, and a deploy replaces that file wholesale. Two
consequences follow:

- **`project.slug` must be unique on the board.** A tenant whose slug equals the owner's slug is
  refused, because deploying would overwrite the owner's gateway fragment and take its sites down.
- **A project's fragment must list every domain that project serves.** If the file on the box
  serves domains the config no longer declares, the deploy stops and names them rather than
  silently dropping them.

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
echo "$USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/010-stacks
sudo chmod 440 /etc/sudoers.d/010-stacks
```

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
- The `raspberry-pi` profile already caps journald retention, which is the largest routine writer.
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
systemctl status rpx
cat /etc/rpx/sites.d/<slug>.json
df -h                                  # a full disk stops everything quietly
```

If the unit is running but nothing answers, the port is the usual cause. Confirm what is bound
with `ss -lntp` and compare it against the site's configured port. If the unit is not enabled, it
started from a deploy but was never wired into boot: re-run `buddy deploy --prod`, which installs
and enables the units.

## Where the state lives

- `storage/cloud/` on your machine holds the ts-cloud state, including the pin for this host: its
  address, SSH user and port, key path, host key fingerprint and profile.
- `/var/ts-cloud/staging` on the board is the deploy staging path.
- `/etc/rpx/sites.d/<slug>.json` on the board is this project's gateway fragment.

`buddy cloud` lists the fleet for an `ssh` project from the config and those pins. There is no
provider API to enumerate, so a host is in the list because your config or a previous deploy names
it, and its status reads `unknown`. Nothing polls these hosts. `buddy server:doctor` is what
actually asks.

## Related

- [Deploy](/guide/cloud/deployment) - the three deploy targets and how `cloud.provider` selects
- [buddy deploy](/guide/buddy/deploy) - every flag on the deploy command
- [Extend Cloud](/guide/cloud/extend) - custom infrastructure
