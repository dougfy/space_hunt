#!/bin/bash
# playtest-monitor.sh — Stream and log telemetry events from a devvit subreddit
# Usage: ./playtest-monitor.sh [subreddit] [since]
# Example: ./playtest-monitor.sh valcordia_space_dev 5m

SUBREDDIT="${1:-valcordia_space_dev}"
SINCE="${2:-5m}"
LOG_DIR="$(dirname "$0")/playtest-logs"
LOG_FILE="$LOG_DIR/telemetry_$(date +%Y%m%d_%H%M%S).jsonl"

mkdir -p "$LOG_DIR"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Playtest Monitor — r/$SUBREDDIT (since $SINCE)          "
echo "║  Logging to: $LOG_FILE"
echo "║  Press Ctrl+C to stop                                     "
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

npx devvit logs "$SUBREDDIT" --since "$SINCE" 2>&1 | while IFS= read -r line; do
  # Only process TELEMETRY lines
  if [[ "$line" == *"[TELEMETRY]"* ]]; then
    # Extract timestamp (first field before the log content)
    ts=$(echo "$line" | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1)
    ts="${ts:-$(date +%H:%M:%S)}"
    
    # Extract the telemetry payload after [TELEMETRY]
    payload="${line#*\[TELEMETRY\]}"
    
    # Parse: user event [details]
    user=$(echo "$payload" | awk '{print $1}')
    event=$(echo "$payload" | awk '{print $2}')
    details=$(echo "$payload" | awk '{$1=$2=""; print $0}' | sed 's/^ *//')
    
    # Format output
    case "$event" in
      app_ready)
        echo "  $ts │ $user │ 📡 app_ready"
        ;;
      journey_started)
        echo "  $ts │ $user │ ▶️  journey_started (id: ${details:0:8}…)"
        ;;
      journey_ended)
        echo "  $ts │ $user │ ⏹️  journey_ended ($details)"
        ;;
      progress)
        progress_val=$(echo "$details" | awk '{print $1}')
        action=$(echo "$details" | awk '{print $2}')
        pct=$(echo "$progress_val" | awk '{printf "%d", $1 * 100}')
        echo "  $ts │ $user │ [$pct%] $action"
        ;;
      interaction)
        echo "  $ts │ $user │ 🔘 $details"
        ;;
      *)
        echo "  $ts │ $user │ $event $details"
        ;;
    esac
    
    # Log as JSONL
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"user\":\"$user\",\"event\":\"$event\",\"details\":\"$details\"}" >> "$LOG_FILE"
  fi
done
