import os
import subprocess
import json
import ilq
import eventsq

all_events = []

all_events.extend(ilq.get_events())
all_events.extend(eventsq.get_events())

with open('./scraping/events_data.json', 'w', encoding='utf-8') as f:
    json.dump(all_events, f, indent=4, ensure_ascii=False)

