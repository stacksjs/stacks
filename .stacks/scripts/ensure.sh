#!/bin/bash

REQUIRED_NODE_VERSION=$(cat ./node-version)

INSTALLED_NODE_VERSION=$(node -v 2>/dev/null || echo "")
INSTALLED_NODE_VERSION=${INSTALLED_NODE_VERSION#v} # removes the 'v' prefix
INSTALLED_NODE_MAJOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f1)
INSTALLED_NODE_MINOR=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f2)
INSTALLED_NODE_PATCH=$(echo "$INSTALLED_NODE_VERSION" | cut -d. -f3)

REQUIRED_NODE_MAJOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f1)
REQUIRED_NODE_MINOR=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f2)
REQUIRED_NODE_PATCH=$(echo "$REQUIRED_NODE_VERSION" | cut -d. -f3)

if [[ "$INSTALLED_NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" || \
      ( "$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -lt "$REQUIRED_NODE_MINOR" ) || \
      ( "$INSTALLED_NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" && "$INSTALLED_NODE_MINOR" -eq "$REQUIRED_NODE_MINOR" && "$INSTALLED_NODE_PATCH" -lt "$REQUIRED_NODE_PATCH" ) ]]
then
     #!/bin/sh

set -e
set -o noglob

# prevent existing env breaking this script
unset TEA_DESTDIR
unset TEA_VERSION

unset stop
while test "$#" -gt 0 -a -z "$stop"; do
	case $1 in
	--prefix)
		# we don’t use TEA_PREFIX so any already installed tea that we use in this script doesn’t break
		TEA_DESTDIR="$2"
		if test -z "$TEA_DESTDIR"; then
			echo "tea: error: --prefix requires an argument" >&2
			exit 1
		fi
		shift;shift;;
	--version)
		TEA_VERSION="$2"
		if test -z "$TEA_VERSION"; then
			echo "tea: error: --version requires an argument" >&2
			exit 1
		fi
		shift;shift;;
	--yes|-y)
		TEA_YES=1
		shift;;
	--help|-h)
		echo "tea: docs: https://github.com/teaxyz/setup"
		exit;;
	*)
		stop=1;;
	esac
done
unset stop


####################################################################### funcs
prepare() {
	# ensure ⌃C works
	#FIXME doesn’t seem to work through `gum` prompts
	trap "echo; exit" INT

	if ! command -v tar >/dev/null 2>&1; then
		echo "tea: error: sorry. pls install tar :(" >&2
	fi

	if test -n "$VERBOSE" -o -n "$GITHUB_ACTIONS" -a -n "$RUNNER_DEBUG"; then
		set -x
	fi

	if test $# -eq 0; then
		MODE="install"
	else
		MODE="exec"
	fi

	HW_TARGET=$(uname)/$(uname -m)

	ZZ=gz

	case $HW_TARGET in
	Darwin/arm64)
		ZZ=xz
		MIDFIX=darwin/aarch64;;
	Darwin/x86_64)
		ZZ=xz
		MIDFIX=darwin/x86-64;;
	Linux/arm64|Linux/aarch64)
		MIDFIX=linux/aarch64;;
	Linux/x86_64)
		MIDFIX=linux/x86-64;;
	*)
		echo "tea: error: (currently) unsupported OS or architecture ($HW_TARGET)" >&2
		echo "let’s talk about it: https://github.com/orgs/teaxyz/discussions" >&2
		exit 1;;
	esac

	# We support minimum OS version of 11 on Darwin
	if test "$(uname)" = "Darwin"; then
		MAJOR=$(sw_vers -productVersion | cut -d . -f 1)
		if test "$MAJOR" -lt 11; then
			echo "tea: error: we currently don't support macOS versions less than 11" >&2
			echo "let’s talk about it: https://github.com/orgs/teaxyz/discussions" >&2
			exit 1
		fi
	fi

	if test $ZZ = 'gz'; then
		if command -v base64 >/dev/null 2>&1; then
			BASE64_TARXZ="/Td6WFoAAATm1rRGAgAhARYAAAB0L+Wj4AX/AFNdADMb7AG6cMNAaNMVK8FvZMaza8QKKTQY6wZ3kG/F814lHE9ruhkFO5DAG7XNamN7JMHavgmbbLacr72NaAzgGUXOstqUaGb6kbp7jrkF+3aQT12CAAB8Uikc1gG8RwABb4AMAAAAeGbHwbHEZ/sCAAAAAARZWg=="
			if echo "$BASE64_TARXZ" | base64 -d | tar Jtf - >/dev/null 2>&1; then
				ZZ=xz
			fi
		elif command -v uudecode >/dev/null 2>&1; then
			TMPFILE=$(mktemp)
			cat >"$TMPFILE" <<-EOF
				begin 644 foo.tar.xz
				M_3=Z6%H\`\`\`3FUK1&\`@\`A\`18\`\`\`!T+^6CX\`7_\`%-=\`#,;[\`&Z<,-\`:-,5*\%O
				M9,:S:\0**308ZP9WD&_%\UXE'$]KNAD%.Y#\`&[7-:F-[),':O@F;;+:<K[V-
				M:\`S@&47.LMJ4:&;ZD;I[CKD%^W:03UV"\`\`!\4BD<U@&\1P\`!;X\`,\`\`\`\`>&;'
				-P;'\$9_L"\`\`\`\`\`\`196@\`\`
				\`
				end
				EOF
			if uudecode -p "$TMPFILE" | tar Jtf - >/dev/null 2>&1; then
				ZZ=xz
			fi
		fi
	fi

	case "$ZZ" in
	gz)
		TAR_FLAGS=xz;; # confusingly
	xz)
		TAR_FLAGS=xJ;;
	esac

	if test -z "$TEA_DESTDIR"; then
		# update existing installation if found
		if command -v tea >/dev/null 2>&1; then
			set +e
			TEA_DESTDIR="$(tea --prefix --silent)"
			if test $? -eq 0 -a -n "$TEA_DESTDIR"; then
				ALREADY_INSTALLED=1
			else
				# probably it’s actually gitea and not teaxyz
				unset TEA_DESTDIR
			fi
			set -e
		fi

		# we check again: in case the above failed for some reason
		if test -z "$TEA_DESTDIR"; then
			if test "$MODE" = exec; then
				TEA_DESTDIR="$(mktemp -dt tea-XXXXXX)"
			else
				TEA_DESTDIR="$HOME/.tea"
				# make our configurations portable
				TEA_DESTDIR_WRITABLE="\$HOME/.tea"
			fi
		fi
	fi

	if test -z "$TEA_DESTDIR_WRITABLE"; then
		TEA_DESTDIR_WRITABLE="$TEA_DESTDIR"
	fi

	if test -z "$CURL"; then
		if command -v curl >/dev/null 2>&1; then
			CURL="curl -Ssf"
		elif test -f "$TEA_DESTDIR/curl.se/v*/bin/curl"; then
			CURL="$TEA_DESTDIR/curl.se/v*/bin/curl -Ssf"
		else
			# how they got here without curl: we dunno
			echo "tea: error: you need curl (or set \`\$CURL\`)" >&2
			exit 1
		fi
	fi
}

get_gum() {
	if command -v gum >/dev/null 2>&1; then
		TEA_GUM=gum
	elif test -n "$ALREADY_INSTALLED"; then
		TEA_GUM="tea --silent +charm.sh/gum gum"
	fi

	if test -n "$TEA_GUM"; then
		if ! "$TEA_GUM" --version >/dev/null 2>&1; then
			# apparently this gum is broken
			unset TEA_GUM
		else
			return 0
		fi
	fi

	if test -f "$TEA_DESTDIR/charm.sh/gum/v0.9.0/bin/gum"; then
		TEA_GUM="$TEA_DESTDIR/charm.sh/gum/v0.9.0/bin/gum"
	else
		URL="https://dist.tea.xyz/charm.sh/gum/$MIDFIX/v0.9.0.tar.$ZZ"
		mkdir -p "$TEA_DESTDIR"
		# shellcheck disable=SC2291
		printf "one moment, just steeping some leaves…"
		$CURL "$URL" | tar "$TAR_FLAGS" -C "$TEA_DESTDIR"
		TEA_GUM="$TEA_DESTDIR/charm.sh/gum/v0.9.0/bin/gum"
		printf "\r                                      "
	fi
}

gum_func() {
	case "$1" in
	confirm)
		if test -n "$TEA_YES"; then
			set +e  # waiting on: https://github.com/charmbracelet/gum/pull/148
			$TEA_GUM "$@" --timeout=1ms --default=yes
			set -e
			return 0
		elif test ! -t 1; then
			echo "tea: error: no tty detected, re-run with \`TEA_YES=1\` set" >&2
			return 1
		fi;;
	spin)
		if test ! -t 1; then
			while test "$1" != --title -a -n "$1"; do
				shift
			done
			if test -z "$VERBOSE"; then
				echo "tea: spin: $2" >&2
			fi
			while test "$1" != -- -a -n "$1"; do
				shift
			done
			shift
			"$@"
			return
		fi;;
	esac

	$TEA_GUM "$@"

	RV="$?"

	if test -z "$__TEA_WE_ABORT" -a "$1" = confirm -a "$RV" -eq 130; then
		echo 'aborting…'
		exit 130
	else
		return "$RV"
	fi
}

welcome() {
	gum_func format -- <<-EoMD
		# hi 👋 let’s set up tea

		* we’ll put it here: \`$TEA_DESTDIR\`
		* everything tea installs goes there
		* (we won’t touch anything else)

		> docs https://github.com/teaxyz/cli#getting-started
		EoMD

	echo  #spacer

	if ! __TEA_WE_ABORT=1 gum_func confirm "how about it?" --affirmative="install tea" --negative="cancel"
	then
			#0123456789012345678901234567890123456789012345678901234567890123456789012
		gum_func format -- <<-EoMD
			# kk, aborting

			btw \`tea\`’s just a standalone executable; you can run it anywhere; you \\
			don’t need to install it

			> check it https://github.com/teaxyz/cli
			EoMD
		echo  #spacer
		exit 1
	fi
}

get_tea_version() {
	if test -n "$TEA_VERSION"; then
		return
	fi

	v_sh="$(mktemp)"
	cat <<-EoMD >"$v_sh"
		$CURL "https://dist.tea.xyz/tea.xyz/$MIDFIX/versions.txt" | tail -n1 > "$v_sh"
		EoMD

	gum_func spin --title 'determining tea version' -- sh "$v_sh"

	TEA_VERSION="$(cat "$v_sh")"

	if test -z "$TEA_VERSION"; then
		echo "failed to get latest tea version" >&2
		exit 1
	fi
}

fix_links() {
	OLDWD="$PWD"

	link() {
		if test -d "v$1" -a ! -L "v$1"; then
			echo "'v$1' is unexpectedly a directory" >&2
		else
			rm -f "v$1"
			ln -s "v$TEA_VERSION" "v$1"
		fi
	}

	cd "$TEA_DESTDIR"/tea.xyz
	link \*
	link "$(echo "$TEA_VERSION" | cut -d. -f1)"
	link "$(echo "$TEA_VERSION" | cut -d. -f1-2)"
	cd "$OLDWD"
}

install() {
	if test -n "$ALREADY_INSTALLED"; then
		TITLE="updating to tea@$TEA_VERSION"
	else
		TITLE="fetching tea@$TEA_VERSION"
	fi

	#NOTE using script instead of passing args to gum because
	# periodically the data didn’t pipe to tar causing it to error
	mkdir -p "$TEA_DESTDIR"
	TEA_DESTDIR="$(cd $TEA_DESTDIR && pwd)"  # we need this PATH to be an absolute path for later stuff
	TEA_TMP_SCRIPT="$(mktemp)"
	URL="https://dist.tea.xyz/tea.xyz/$MIDFIX/v$TEA_VERSION.tar.$ZZ"
	echo "set -e; $CURL '$URL' | tar '$TAR_FLAGS' -C '$TEA_DESTDIR'" > "$TEA_TMP_SCRIPT"
	gum_func spin --title "$TITLE" -- sh "$TEA_TMP_SCRIPT"

	fix_links

	if ! test "$MODE" = exec; then
		gum_func format -- "k, we installed \`$TEA_DESTDIR/tea.xyz/v$TEA_VERSION/bin/tea\`"
	fi

	TEA_VERSION_MAJOR="$(echo "$TEA_VERSION" | cut -d. -f1)"
	TEA_EXENAME="$TEA_DESTDIR/tea.xyz/v$TEA_VERSION_MAJOR/bin/tea"

	echo  #spacer
}

check_path() {
	gum_func format -- <<-EoMD
		# one second!
		without magic, tea’s not in your path!
		> *we may need to ask for your **root password*** (via \`sudo\` obv.)
		EoMD

	if gum_func confirm "create /usr/local/bin/tea?" --affirmative="make symlink" --negative="skip"
	then
		echo  #spacer

		# NOTE: Binary -a and -o are inherently ambiguous.  Use 'test EXPR1
		#   && test EXPR2' or 'test EXPR1 || test EXPR2' instead.
		# https://man7.org/linux/man-pages/man1/test.1.html
		if test -w /usr/local/bin || (test ! -e /usr/local/bin && mkdir -p /usr/local/bin >/dev/null 2>&1)
		then
			mkdir -p /usr/local/bin
			ln -sf "$TEA_EXENAME" /usr/local/bin/tea
		elif command -v sudo >/dev/null 2>&1
		then
			sudo --reset-timestamp
			sudo mkdir -p /usr/local/bin
			sudo ln -sf "$TEA_EXENAME" /usr/local/bin/tea
		else
			echo  #spacer
			gum_func format -- <<-EoMD
				> hmmm, sudo command not found.
				> try installing sudo
				EoMD
		fi

		if ! command -v tea >/dev/null 2>&1
		then

			echo  #spacer
			gum_func format -- <<-EoMD
				> hmmm, \`/usr/local/bin\` isn’t in your path,
				> you’ll need to fix that yourself.
				> sorry 😞

				\`PATH=$PATH\`
				EoMD
		fi
	fi

	echo  #spacer
}

check_shell_magic() {
	if test $TEA_VERSION_MAJOR -eq 0; then
		__TEA_MINOR_VERSION=$(echo $TEA_VERSION | cut -d. -f2)
		if test $__TEA_MINOR_VERSION -lt 19; then
			# we cannot any longer support magic below 0.19.0
			return 1
		fi
	fi

	# foo knows I cannot tell you why $SHELL may be unset
	if test -z "$SHELL"; then
		if command -v finger >/dev/null 2>&1; then
			SHELL="$(finger "$USER" | grep Shell | cut -d: -f3 | tr -d ' ')"
		elif command -v getent >/dev/null 2>&1; then
			SHELL="$(getent passwd "$USER")"
		elif command -v id >/dev/null 2>&1; then
			SHELL="$(id -P | cut -d ':' -f 10)"
		# Try to fall back with some level of normalcy
		elif test "$(uname)" == "Darwin"; then
			SHELL=zsh
		else
			SHELL=bash
		fi
	fi

	SHELL=$(basename "$SHELL") # just in case

	__TEA_ONE_LINER="test -d \"$TEA_DESTDIR_WRITABLE\" && source <(\"$TEA_DESTDIR_WRITABLE/tea.xyz/v*/bin/tea\" --magic=$SHELL --silent)"

	case "$SHELL" in
	zsh)
		if test -n "$ZDOTDIR"; then
			__TEA_ZSHRC="$ZDOTDIR/.zshrc"
			__TEA_SH_FILE="$__TEA_ZSHRC"
		else
			# shellcheck disable=SC2088
			__TEA_ZSHRC="~/.zshrc"
			__TEA_SH_FILE="$HOME/.zshrc"
		fi
		__TEA_BTN_TXT="add one-liner to your \`$__TEA_ZSHRC\`?"
		;;
	bash)
		__TEA_SH_FILE="$HOME/.bashrc"
		__TEA_BTN_TXT="add one-liner to your \`~/.bashrc\`?"
		;;
	elvish)
		__TEA_SH_FILE="$HOME/.config/elvish/rc.elv"
		__TEA_BTN_TXT="add one-liner to your \`~/.config/elvish/rc.elv\`?"
		;;
	fish)
		__TEA_SH_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"
		__TEA_BTN_TXT="add one-liner to your \`config.fish\`?"
		__TEA_ONE_LINER="test -d \"$TEA_DESTDIR_WRITABLE\" && \"$TEA_DESTDIR_WRITABLE/tea.xyz/v*/bin/tea\" --magic=fish --silent | source"
		;;
	*)
		gum_func format -- <<-EoMD
			# we need your help 🙏

			tea’s magic is optional but it’s the way it’s meant to be used.

			we don’t know how to support \`$SHELL\` yet. can you make a pull request?

			> https://github.com/teaxyz/cli/pulls
			EoMD
		return 1
	esac

	if command -v grep >/dev/null 2>&1 && grep --fixed-strings "$__TEA_ONE_LINER" "$__TEA_SH_FILE" --silent; then
		# shell magic already installed
		return 0
	fi

	gum_func format -- <<-EoMD
		# may we interest you in some magic?

		tea’s shell magic is optional but it’s the way it’s meant to be used.

		> docs https://github.com/teaxyz/cli#magic
		EoMD

	if gum_func confirm "$__TEA_BTN_TXT" --affirmative="add one-liner" --negative="skip"; then
		echo >> "$__TEA_SH_FILE"
		echo "$__TEA_ONE_LINER" >> "$__TEA_SH_FILE"

		echo  #spacer

		gum_func format -- <<-EoMD
			Added:

			\`$__TEA_ONE_LINER\`
			EoMD

		echo  #spacer

	else
		return 1  # we need to offer a symlink to tea instead
	fi
}

########################################################################## go
prepare "$@"
get_gum
if test $MODE = install -a -z "$ALREADY_INSTALLED"; then
	welcome
fi
get_tea_version
if ! test -f "$TEA_DESTDIR/tea.xyz/v$TEA_VERSION/bin/tea"; then
	install
else
	fix_links  # be proactive in repairing the user installation just in case that's what they ran this for
	TEA_IS_CURRENT=1
	TEA_VERSION_MAJOR="$(echo "$TEA_VERSION" | cut -d. -f1)"
	TEA_EXENAME="$TEA_DESTDIR/tea.xyz/v$TEA_VERSION_MAJOR/bin/tea"
fi

if ! test -d "$TEA_DESTDIR/tea.xyz/var/pantry"; then
	title="prefetching"
elif command -v git >/dev/null 2>&1; then
	title="syncing"
fi

gum_func spin --title "$title pantry" -- "$TEA_EXENAME" --sync --cd / echo

case $MODE in
install)
	if ! test -n "$ALREADY_INSTALLED"; then
		if ! check_shell_magic; then
			check_path
			gum_func format -- <<-EoMD
				# you’re all set!

				try it out:

				\`tea wget -qO- tea.xyz/white-paper | tea glow -\`
				EoMD
		else
			if test -n "$GITHUB_ACTIONS"; then
				# if the user did call us directly from GHA may as well help them out
				echo "$TEA_DESTDIR/tea.xyz/v$TEA_VERSION_MAJOR/bin" >> "$GITHUB_PATH"
			fi

			gum_func format -- <<-EoMD
				# you’re all set!

				try it out:

				\`exec $SHELL -i\`  # or open a new tab
				\`wget -qO- tea.xyz/white-paper | glow -\`
				EoMD
		fi
	elif test -n "$TEA_IS_CURRENT"; then
		gum_func format -- <<-EoMD
			# the latest version of tea was already installed
			> $TEA_DESTDIR/tea.xyz/v$TEA_VERSION/bin/tea
			EoMD
	fi
	echo  #spacer
	;;
exec)
	# ensure we use the just installed tea
	export TEA_PREFIX="$TEA_DESTDIR"

	if test -z "$ALREADY_INSTALLED" -a -t 1; then
		$TEA_EXENAME "$@"

		echo  #spacer

		gum_func format <<-EoMD >&2
			> powered by [tea](https://tea.xyz)
			EoMD

		echo  #spacer
	else
		# don’t hog resources
		exec $TEA_EXENAME "$@"
	fi
	;;
esac
fi

echo "Node.js version $REQUIRED_NODE_VERSION or greater is installed!"
