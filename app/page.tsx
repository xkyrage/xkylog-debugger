'use client';

import React, { useMemo, useState } from 'react';
import {
  Copy,
  Search,
  Wand2,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function MiniKibanaLogParser() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const safeJsonParse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {}

    try {
      return JSON.parse(text.replace(/\\"/g, '"'));
    } catch {}

    return text;
  };

  const extractJsonBlocks = (text: string) => {
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

    const parsed = lines.map((line, index) => {
      const metadata = {
        time: line.match(/time="([^"]+)"/)?.[1] || '',
        level: line.match(/level=([^ ]+)/)?.[1] || '',
        msg: line.match(/msg="([^"]+)"/)?.[1] || '',
        id: line.match(/id=([^ ]+)/)?.[1] || '',
        latency: line.match(/latency=([^ ]+)/)?.[1] || '',
        method: line.match(/method=([^ ]+)/)?.[1] || '',
        status: line.match(/status="([^"]+)"/)?.[1] || '',
        uri: line.match(/uri="([^"]+)"/)?.[1] || '',
      };

      const jsonBlocks = extractJsonBlocks(line).map((b) => safeJsonParse(b));

      let section = 'OTHER';
      if (metadata.msg.toLowerCase().includes('request')) section = 'REQUEST';
      if (metadata.msg.toLowerCase().includes('response')) section = 'RESPONSE';

      let health = 'healthy';
      const latencyMs = parseFloat(metadata.latency);

      if (metadata.status && !metadata.status.startsWith('200')) {
        health = 'error';
      } else if (!isNaN(latencyMs) && latencyMs > 500) {
        health = 'slow';
      }

      return {
        id: index,
        raw: line,
        metadata,
        jsonBlocks,
        section,
        health,
      };
    });

    setLogs(parsed);
  };

  const groupedLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      const matchesQuery =
        !query ||
        JSON.stringify(log).toLowerCase().includes(query.toLowerCase());

      const matchesLevel =
        levelFilter === 'all' || log.metadata.level === levelFilter;

      return matchesQuery && matchesLevel;
    });

    return filtered.reduce((acc: any, log: any) => {
      const key = log.metadata.id || `ungrouped-${log.id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});
  }, [logs, query, levelFilter]);

  const stats = useMemo(
    () => ({
      total: logs.length,
      errors: logs.filter((l) => l.health === 'error').length,
      slow: logs.filter((l) => l.health === 'slow').length,
      healthy: logs.filter((l) => l.health === 'healthy').length,
    }),
    [logs]
  );

  const copyJson = async (data: any) => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const healthBadge = (health: string) => {
    if (health === 'error') {
      return (
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> ERROR
        </span>
      );
    }

    if (health === 'slow') {
      return (
        <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" /> SLOW
        </span>
      );
    }

    return (
      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> OK
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="bg-white rounded-2xl shadow p-6 space-y-4">
          <h1 className="text-3xl font-bold">Mini Kibana Log Debugger</h1>
          <p className="text-sm text-gray-500">
            Timeline view, request grouping, payload inspection, health indicators, and filtering.
          </p>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste raw logs here..."
            className="w-full min-h-[220px] border rounded-lg p-4 font-mono text-sm"
          />

          <button
            onClick={parseLogs}
            className="w-full bg-black text-white px-4 py-3 rounded-lg flex justify-center items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Parse Logs
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Healthy" value={stats.healthy} />
          <StatCard label="Slow" value={stats.slow} />
          <StatCard label="Errors" value={stats.errors} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-full border rounded-lg p-2 pl-10"
            />
          </div>

          <select
            className="border rounded-lg px-3 py-2"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedLogs).map(([groupId, entries]: any) => (
            <div key={groupId} className="bg-white rounded-2xl shadow p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Request Timeline: {groupId}</h2>
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {entries.length} events
                </span>
              </div>

              <div className="space-y-4 border-l-2 pl-4">
                {entries.map((log: any) => (
                  <div key={log.id} className="border rounded-xl p-4 space-y-3">

                    <div className="flex gap-2 flex-wrap items-center">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                        {log.section}
                      </span>
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {log.metadata.level}
                      </span>
                      {healthBadge(log.health)}
                    </div>

                    <div className="text-sm text-gray-600">
                      {log.metadata.time} — {log.metadata.msg}
                    </div>

                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(log.metadata).map(
                        ([k, v]: any) =>
                          v && (
                            <div key={k} className="bg-gray-100 rounded p-2">
                              <strong>{k}:</strong> {v}
                            </div>
                          )
                      )}
                    </div>

                    {log.jsonBlocks.map((json: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            Payload #{idx + 1}
                          </span>

                          <button
                            onClick={() => copyJson(json)}
                            className="border px-3 py-1 rounded flex items-center gap-2 text-sm"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                        </div>

                        <textarea
                          readOnly
                          value={
                            typeof json === 'string'
                              ? json
                              : JSON.stringify(json, null, 2)
                          }
                          className="w-full min-h-[180px] border rounded p-3 font-mono text-sm"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <strong>{label}:</strong> {value}
    </div>
  );
}
