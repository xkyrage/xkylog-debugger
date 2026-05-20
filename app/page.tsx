'use client'

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Search, Wand2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

export default function MiniKibanaLogParser() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  const safeJsonParse = (text) => {
    try { return JSON.parse(text); } catch {}
    try { return JSON.parse(text.replace(/\\\"/g, '"')); } catch {}
    return text;
  };

  const extractJsonBlocks = (text) => {
    const matches = [];
    let stack = 0, start = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') { if (stack === 0) start = i; stack++; }
      else if (text[i] === '}') {
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
        time: line.match(/time="([^"]+)"/)?.[1],
        level: line.match(/level=([^ ]+)/)?.[1],
        msg: line.match(/msg="([^"]+)"/)?.[1],
        id: line.match(/id=([^ ]+)/)?.[1],
        latency: line.match(/latency=([^ ]+)/)?.[1],
        method: line.match(/method=([^ ]+)/)?.[1],
        status: line.match(/status="([^"]+)"/)?.[1],
        uri: line.match(/uri="([^"]+)"/)?.[1],
      };

      const jsonBlocks = extractJsonBlocks(line).map((b) => safeJsonParse(b));

      let section = 'OTHER';
      if (metadata.msg?.toLowerCase().includes('request')) section = 'REQUEST';
      if (metadata.msg?.toLowerCase().includes('response')) section = 'RESPONSE';

      let health = 'healthy';
      const latencyMs = parseFloat(metadata.latency);
      if (metadata.status && !metadata.status.startsWith('200')) health = 'error';
      else if (!isNaN(latencyMs) && latencyMs > 500) health = 'slow';

      return { id: index, raw: line, metadata, jsonBlocks, section, health };
    });

    setLogs(parsed);
  };

  const groupedLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      const matchesQuery = !query || JSON.stringify(log).toLowerCase().includes(query.toLowerCase());
      const matchesLevel = levelFilter === 'all' || log.metadata.level === levelFilter;
      return matchesQuery && matchesLevel;
    });

    return filtered.reduce((acc, log) => {
      const key = log.metadata.id || `ungrouped-${log.id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});
  }, [logs, query, levelFilter]);

  const stats = useMemo(() => ({
    total: logs.length,
    errors: logs.filter(l => l.health === 'error').length,
    slow: logs.filter(l => l.health === 'slow').length,
    healthy: logs.filter(l => l.health === 'healthy').length,
  }), [logs]);

  const copyJson = async (data) => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const healthBadge = (health) => {
    if (health === 'error') return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> ERROR</Badge>;
    if (health === 'slow') return <Badge><Clock className="w-3 h-3 mr-1" /> SLOW</Badge>;
    return <Badge variant="outline"><CheckCircle className="w-3 h-3 mr-1" /> OK</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <Card className="rounded-2xl shadow-xl">
          <CardContent className="p-6 space-y-4">
            <h1 className="text-3xl font-bold">Mini Kibana Log Debugger</h1>
            <p className="text-sm text-gray-500">Timeline view, request grouping, payload inspection, health indicators, and filtering.</p>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste raw logs here..."
              className="min-h-[220px] font-mono text-sm"
            />

            <Button onClick={parseLogs} className="w-full">
              <Wand2 className="w-4 h-4 mr-2" /> Parse Logs
            </Button>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><strong>Total:</strong> {stats.total}</CardContent></Card>
          <Card><CardContent className="p-4"><strong>Healthy:</strong> {stats.healthy}</CardContent></Card>
          <Card><CardContent className="p-4"><strong>Slow:</strong> {stats.slow}</CardContent></Card>
          <Card><CardContent className="p-4"><strong>Errors:</strong> {stats.errors}</CardContent></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs..." className="pl-10" />
          </div>
          <select
            className="border rounded-md px-3 py-2"
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
          {Object.entries(groupedLogs).map(([groupId, entries]) => (
            <Card key={groupId} className="rounded-2xl shadow-md">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Request Timeline: {groupId}</h2>
                  <Badge>{entries.length} events</Badge>
                </div>

                <div className="space-y-4 border-l-2 pl-4">
                  {entries.map((log) => (
                    <Card key={log.id} className="border rounded-xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex gap-2 flex-wrap items-center">
                          <Badge>{log.section}</Badge>
                          <Badge variant="outline">{log.metadata.level}</Badge>
                          {healthBadge(log.health)}
                        </div>

                        <div className="text-sm text-gray-600">{log.metadata.time} — {log.metadata.msg}</div>

                        <div className="grid md:grid-cols-2 gap-2 text-sm">
                          {Object.entries(log.metadata).map(([k, v]) => v && (
                            <div key={k} className="bg-gray-100 rounded p-2"><strong>{k}:</strong> {v}</div>
                          ))}
                        </div>

                        {log.jsonBlocks.map((json, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">Payload #{idx + 1}</span>
                              <Button variant="outline" size="sm" onClick={() => copyJson(json)}>
                                <Copy className="w-4 h-4 mr-2" /> Copy
                              </Button>
                            </div>
                            <Textarea
                              readOnly
                              value={typeof json === 'string' ? json : JSON.stringify(json, null, 2)}
                              className="min-h-[180px] font-mono text-sm"
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
