'use client';

import React, { useMemo, useState } from 'react';
import { Copy, Search, Wand2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function Page() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const extractJson = (text: string) => {
    const matches = [];
    let stack = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (stack === 0) start = i;
        stack++;
      } else if (text[i] === '}') {
        stack--;
        if (stack === 0 && start !== -1) {
          matches.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return matches;
  };

  const parseLogs = () => {
    const lines = input.split('\n').filter(Boolean);

    const parsed = lines.map((line, i) => {
      const metadata = {
        time: line.match(/time="([^"]+)"/)?.[1] || '',
        level: line.match(/level=([^ ]+)/)?.[1] || '',
        msg: line.match(/msg="([^"]+)"/)?.[1] || '',
        id: line.match(/id=([^ ]+)/)?.[1] || '',
        latency: line.match(/latency=([^ ]+)/)?.[1] || '',
        status: line.match(/status="([^"]+)"/)?.[1] || '',
      };

      const jsonBlocks = extractJson(line);

      let health = 'ok';
      if (metadata.status && !metadata.status.startsWith('200')) health = 'error';
      if (parseFloat(metadata.latency) > 500) health = 'slow';

      return { id: i, metadata, jsonBlocks, health };
    });

    setLogs(parsed);
  };

  const filtered = useMemo(() => {
    return logs.filter((l) =>
      JSON.stringify(l).toLowerCase().includes(query.toLowerCase())
    );
  }, [logs, query]);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Mini Kibana Debugger</h1>

      <textarea
        style={{ width: '100%', height: 200 }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button onClick={parseLogs}>
        <Wand2 size={16} /> Parse
      </button>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div>
        {filtered.map((log) => (
          <div key={log.id} style={{ border: '1px solid #ddd', marginTop: 10, padding: 10 }}>
            <div>
              <strong>{log.metadata.time}</strong> — {log.metadata.msg}
            </div>

            <div>Status: {log.metadata.status} | Latency: {log.metadata.latency}</div>

            {log.jsonBlocks.map((j: any, i: number) => (
              <pre key={i} style={{ background: '#f4f4f4', padding: 10 }}>
                {j}
              </pre>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
