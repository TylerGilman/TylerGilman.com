#!/bin/bash
# Replace with your actual textbook path
TEXTBOOK_PATH="$HOME/path/to/your/textbook.pdf"

if [ -f "$TEXTBOOK_PATH" ]; then
    xdg-open "$TEXTBOOK_PATH"
else
    notify-send "Textbook not found" "Could not find: $TEXTBOOK_PATH"
fi