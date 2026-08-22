#!/usr/bin/env python3
"""Generate a Sankey/funnel chart from playtest telemetry logs.

Usage:
  python3 playtest-sankey.py [logfile.jsonl]
  python3 playtest-sankey.py playtest-logs/  (reads all .jsonl in dir)

Outputs: playtest-sankey.html (interactive Plotly chart)
"""

import json
import sys
import os
from collections import defaultdict
from pathlib import Path

# Ordered journey milestones
MILESTONES = [
    ('app_ready', 'App Ready'),
    ('journey_started', 'Journey Started'),
    ('game_start', 'Game Start'),
    ('returned_player', 'Returned Player'),
    ('first_move', 'First Move'),
    ('home_star_claimed', 'Home Star'),
    ('first_resource_collected', 'First Resource'),
    ('first_building', 'First Building'),
    ('first_ship_built', 'First Ship'),
    ('dock_upgraded', 'Dock Upgraded'),
    ('first_transfer', 'First Transfer'),
    ('ship_upgraded', 'Ship Upgraded'),
    ('first_colony', 'First Colony'),
    ('star_discovered', 'Star Discovered'),
    ('alliance_joined', 'Alliance Joined'),
    ('journey_ended', 'Journey Ended'),
]

MILESTONE_ORDER = {m[0]: i for i, m in enumerate(MILESTONES)}


def load_events(source):
    """Load events from a file or directory of .jsonl files."""
    events = []
    paths = []
    
    if os.path.isdir(source):
        paths = sorted(Path(source).glob('*.jsonl'))
    else:
        paths = [Path(source)]
    
    for p in paths:
        with open(p) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return events


def build_user_journeys(events):
    """Group events by user and build journey sequences."""
    user_events = defaultdict(list)
    
    for ev in events:
        user = ev.get('user', '?')
        event = ev.get('event', '')
        details = ev.get('details', '')
        ts = ev.get('ts', '')
        
        # Normalize event names
        if event == 'progress':
            parts = details.split()
            action = parts[1] if len(parts) > 1 else details
            user_events[user].append({'event': action, 'ts': ts})
        else:
            user_events[user].append({'event': event, 'ts': ts})
    
    return user_events


def compute_funnel(user_journeys):
    """Compute how many users reached each milestone."""
    funnel = defaultdict(int)
    total_users = len(user_journeys)
    
    for user, events in user_journeys.items():
        reached = set(ev['event'] for ev in events)
        for milestone_key, _ in MILESTONES:
            if milestone_key in reached:
                funnel[milestone_key] += 1
    
    return funnel, total_users


def compute_sankey_flows(user_journeys):
    """Compute flow between consecutive milestones for Sankey."""
    flows = defaultdict(int)  # (from_milestone, to_milestone) -> count
    
    for user, events in user_journeys.items():
        # Get ordered milestones this user reached
        reached = []
        seen = set()
        for ev in events:
            key = ev['event']
            if key in MILESTONE_ORDER and key not in seen:
                reached.append(key)
                seen.add(key)
        
        # Sort by milestone order
        reached.sort(key=lambda x: MILESTONE_ORDER.get(x, 999))
        
        # Add "dropped" node for users who didn't complete
        for i in range(len(reached) - 1):
            flows[(reached[i], reached[i + 1])] += 1
        
        # Mark where they dropped off
        if reached and reached[-1] != 'journey_ended':
            flows[(reached[-1], 'DROPPED')] += 1
    
    return flows


def generate_html(funnel, total_users, flows, output='playtest-sankey.html'):
    """Generate an HTML file with Plotly Sankey + funnel charts."""
    
    # Build node list
    all_nodes = []
    node_idx = {}
    
    for key, label in MILESTONES:
        if key in funnel or any(key in f for f in flows):
            node_idx[key] = len(all_nodes)
            all_nodes.append(label)
    
    if 'DROPPED' not in node_idx:
        node_idx['DROPPED'] = len(all_nodes)
        all_nodes.append('Dropped Off')
    
    # Build links
    sources = []
    targets = []
    values = []
    
    for (src, tgt), count in flows.items():
        if src in node_idx and tgt in node_idx:
            sources.append(node_idx[src])
            targets.append(node_idx[tgt])
            values.append(count)
    
    # Funnel data
    funnel_labels = []
    funnel_values = []
    for key, label in MILESTONES:
        if key in funnel:
            funnel_labels.append(label)
            funnel_values.append(funnel[key])
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Playtest Journey Analytics</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body {{ font-family: -apple-system, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }}
        h1 {{ color: #00d4ff; }}
        .chart {{ margin: 20px 0; background: #16213e; border-radius: 8px; padding: 20px; }}
        .stats {{ display: flex; gap: 20px; margin: 20px 0; }}
        .stat {{ background: #0f3460; padding: 15px 25px; border-radius: 8px; text-align: center; }}
        .stat-value {{ font-size: 2em; color: #00d4ff; }}
        .stat-label {{ font-size: 0.9em; color: #aaa; }}
    </style>
</head>
<body>
    <h1>🚀 Playtest Journey Analytics</h1>
    <div class="stats">
        <div class="stat"><div class="stat-value">{total_users}</div><div class="stat-label">Total Players</div></div>
        <div class="stat"><div class="stat-value">{funnel.get('star_discovered', 0)}</div><div class="stat-label">Discovered Stars</div></div>
        <div class="stat"><div class="stat-value">{funnel.get('journey_ended', 0)}</div><div class="stat-label">Journeys Completed</div></div>
    </div>
    
    <div class="chart" id="funnel-chart"></div>
    <div class="chart" id="sankey-chart"></div>
    
    <script>
    // Funnel Chart
    Plotly.newPlot('funnel-chart', [{{
        type: 'funnel',
        y: {json.dumps(funnel_labels)},
        x: {json.dumps(funnel_values)},
        textinfo: 'value+percent initial',
        marker: {{ color: ['#00d4ff', '#00b4d8', '#0096c7', '#0077b6', '#023e8a', '#03045e', '#240046', '#3c096c', '#5a189a', '#7b2cbf', '#9d4edd', '#c77dff', '#e0aaff', '#f72585', '#b5179e', '#560bad'] }}
    }}], {{
        title: {{ text: 'Player Journey Funnel', font: {{ color: '#eee' }} }},
        paper_bgcolor: '#16213e',
        plot_bgcolor: '#16213e',
        font: {{ color: '#ccc' }}
    }});
    
    // Sankey Chart
    Plotly.newPlot('sankey-chart', [{{
        type: 'sankey',
        node: {{
            label: {json.dumps(all_nodes)},
            color: all_nodes.map((_, i) => `hsl(${{i * 360 / {len(all_nodes)}}}, 70%, 50%)`),
            pad: 15,
            thickness: 20
        }},
        link: {{
            source: {json.dumps(sources)},
            target: {json.dumps(targets)},
            value: {json.dumps(values)},
            color: 'rgba(0, 212, 255, 0.3)'
        }}
    }}], {{
        title: {{ text: 'Player Flow (Sankey)', font: {{ color: '#eee' }} }},
        paper_bgcolor: '#16213e',
        font: {{ color: '#ccc' }},
        height: 600
    }});
    </script>
</body>
</html>"""
    
    with open(output, 'w') as f:
        f.write(html)
    
    print(f"✅ Generated: {output}")
    print(f"   {total_users} players, {len(flows)} flow edges")
    print(f"   Open in browser: file://{os.path.abspath(output)}")


def main():
    if len(sys.argv) < 2:
        # Default: look for playtest-logs/ directory
        source = os.path.join(os.path.dirname(__file__), 'playtest-logs')
        if not os.path.exists(source):
            print("Usage: python3 playtest-sankey.py <logfile.jsonl or directory>")
            print("       Or create playtest-logs/ with .jsonl files from playtest-monitor.sh")
            sys.exit(1)
    else:
        source = sys.argv[1]
    
    events = load_events(source)
    if not events:
        print("No events found. Run playtest-monitor.sh first to collect data.")
        sys.exit(1)
    
    print(f"Loaded {len(events)} events from {source}")
    
    user_journeys = build_user_journeys(events)
    funnel, total_users = compute_funnel(user_journeys)
    flows = compute_sankey_flows(user_journeys)
    
    output = os.path.join(os.path.dirname(__file__), 'playtest-sankey.html')
    generate_html(funnel, total_users, flows, output)


if __name__ == '__main__':
    main()
