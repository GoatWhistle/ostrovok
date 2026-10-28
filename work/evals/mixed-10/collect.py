import json
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sql = "select json_build_object('id',c.id,'query',m.content,'saved_at',c.updated_at) from chat_conversations c join chat_messages m on c.id=m.conversation_id where c.created_at > '2026-10-26T13:52:22Z' and m.role='user';"
rows = subprocess.check_output(['docker','compose','exec','-T','db','psql','-U','hotel','-d','hotel','-Atc',sql], text=True)
lookup = {r['query']:r for line in rows.splitlines() if (r:=json.loads(line))}
for path in sorted(ROOT.glob('[0-9][0-9].json')):
    record=json.loads(path.read_text())
    row=lookup.get(record['query'])
    if not row:
        continue
    with urllib.request.urlopen('http://127.0.0.1:8080/api/v1/chat/conversations/'+row['id'],timeout=20) as response:
        body=json.load(response)
    record['late_response']=body
    record['saved_at']=row['saved_at']
    record['time_to_save_s']=round((datetime.fromisoformat(row['saved_at'])-datetime.fromisoformat(record['started_at'])).total_seconds(),2)
    path.write_text(json.dumps(record,ensure_ascii=False,indent=2))
    search=body.get('search') or {}
    print(json.dumps(dict(id=record['id'],seconds=record['time_to_save_s'],parsed=search.get('parsed'),hotels=len(search.get('results',[])),answer=next((m['content'] for m in reversed(body['messages']) if m['role']=='assistant'),None)),ensure_ascii=False))
