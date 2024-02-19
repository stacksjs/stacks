#--------------------------------------------------------------------------
# Stacks buddy plugin for zsh
#--------------------------------------------------------------------------
#
# This plugin adds an `buddy` shell command that will find and execute
# Stacks's buddy command from anywhere within the project. It also
# adds shell completions that work anywhere buddy can be located.
#
# Many thanks to Jess Archer for providing the initial scripts:
# https://github.com/jessarcher/zsh-artisan

function buddy() {
  local buddy_path=$(_buddy_find)

  if [ "$buddy_path" = "" ]; then
    echo >&2 "shell: buddy not found. Are you in a Stacks directory? This only happens if you are not within a Stacks project, and buddy is not installed globally."
    return 1
  fi

  local buddy_path=$(dirname $buddy_path)
  local buddy_cmd

  buddy_cmd="bun $buddy_path/buddy $*"

  local buddy_start_time=$(date +%s)

  eval $buddy_cmd $*

  local buddy_exit_status=$? # Store the exit status so we can return it later

  if [[ $1 = "make:"* && $BUDDY_OPEN_ON_MAKE_EDITOR != "" ]]; then
    # Find and open files created by buddy
    find \
      "$buddy_path/app" \
      "$buddy_path/tests" \
      -type f \
      -newermt "-$(($(date +%s) - $buddy_start_time + 1)) seconds" \
      -exec $BUDDY_OPEN_ON_MAKE_EDITOR {} \; 2>/dev/null
  fi

  return $buddy_exit_status
}

function bud() {
  buddy $*
}

function stacks() {
  buddy $*
}

function stx() {
  buddy $*
}

function b() {
  buddy $*
}

function bi() {
  buddy install
}

function ba() {
  buddy add "$@"
}

function bd() {
  buddy dev "$@"
}

function bb() {
  buddy build "$@"
}

function bt() {
  buddy test
}

function bu() {
  buddy upgrade
}

function brb() {
  bun run build
}

compdef _buddy_add_completion buddy

function _buddy_find() {
  # First, try to find a globally installed buddy binary
  local global_buddy_path=$(which buddy)
  if [ -n "$global_buddy_path" ]; then
    echo "$global_buddy_path"
    return 0
  fi

  # If not found globally, look for buddy up the file tree until the root directory
  local dir=.
  until [ "$dir" -ef / ]; do
    if [ -f "$dir/buddy" ]; then
      echo "$dir/buddy"
      return 0
    fi

    dir+=/..
  done

  return 1
}

function _buddy_add_completion() {
  if [ "$(_buddy_find)" != "" ]; then
    compadd $(_buddy_get_command_list)
  fi
}

function _buddy_get_command_list() {
  buddy list | sed "s/[[:space:]].*//g"
}
