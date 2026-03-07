#!/bin/zsh

SCRIPT_DIR="${0:A:h}"
"$SCRIPT_DIR/scripts/start-dev.sh"
STATUS=$?

if [[ $STATUS -ne 0 ]]; then
  echo ""
  read '?The launcher stopped. Press Enter to close this window.'
fi

exit $STATUS
