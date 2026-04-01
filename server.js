import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// ── AI scoring agent ─────────────────────────────────────────────────────────
async function scoreLead(leadData) {
  const { fname, lname, address, roofTypes, orientation, roofArea,
    bill, usage, provider, goals, timeline, notes } = leadData;

  const prompt = [
    'You are a solar engineering lead qualification AI.',
    'Analyse this lead and return ONLY a valid JSON object with no markdown, no backticks, no explanation.',
    '',
    'Schema:',
    '{',
    '  "score": number 0-100,',
    '  "tier": "Hot" | "Warm" | "Cold",',
    '  "estimatedSystemSize": "e.g. 10 kWp",',
    '  "estimatedPanels": number,',
    '  "estimatedBatteries": "e.g. 2x 10kWh",',
    '  "estimatedROI": "e.g. 4-6 years",',
    '  "priority": "High" | "Medium" | "Low",',
    '  "engineerNotes": "2-3 sentences for the solar engineer covering site considerations, urgency, and key flags",',
    '  "tags": ["array", "of", "short", "tags", "max 5"]',
    '}',
    '',
    'Lead data:',
    'Name: ' + fname + ' ' + lname,
    'Address: ' + address,
    'Roof type: ' + ((roofTypes || []).join(', ') || 'Not specified'),
    'Roof orientation: ' + orientation,
    'Roof area: ' + (roofArea || 'Not given') + ' m2',
    'Monthly bill: ' + bill,
    'Monthly usage: ' + usage,
    'Provider: ' + (provider || 'Not given'),
    'Goals: ' + (goals || []).join(', '),
    'Timeline: ' + timeline,
    'Notes: ' + (notes || 'None'),
    '',
    'Return only the JSON object.'
  ].join('\n');

  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = response.text.replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ── Email notification ───────────────────────────────────────────────────────
async function sendEngineerEmail(lead, ai) {
  const tierColor = { Hot: '#993C1D', Warm: '#854F0B', Cold: '#185FA5' }[ai.tier] || '#333';
  const tierBg   = { Hot: '#FAECE7', Warm: '#FAEEDA', Cold: '#E6F1FB' }[ai.tier] || '#eee';
  const tags = (ai.tags || []).map(t => '<span>' + t + '</span>').join('');
  const date = new Date().toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' });
  const roofTypes = (lead.roofTypes || []).join(', ') || 'N/A';
  const goals = (lead.goals || []).join(', ');
  const clientNotes = lead.notes
    ? '<div class="section"><h2>Client notes</h2><div class="notes">' + lead.notes + '</div></div>'
    : '';

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
    + 'body{font-family:sans-serif;color:#222;max-width:600px;margin:0 auto;padding:24px}'
    + 'h1{font-size:20px;font-weight:600;margin-bottom:4px}'
    + '.sub{color:#666;font-size:14px;margin-bottom:24px}'
    + '.badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:' + tierBg + ';color:' + tierColor + '}'
    + '.score{font-size:28px;font-weight:700;color:' + tierColor + '}'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}'
    + '.metric{background:#f5f5f3;border-radius:8px;padding:12px}'
    + '.metric .label{font-size:11px;color:#888;margin-bottom:4px}'
    + '.metric .value{font-size:16px;font-weight:600}'
    + '.section{margin:20px 0}'
    + '.section h2{font-size:14px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:12px}'
    + '.row{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;border-bottom:1px solid #f0f0f0}'
    + '.row .key{color:#777}.row .val{font-weight:500;text-align:right;max-width:60%}'
    + '.notes{background:#f9f9f7;border-left:3px solid #1D9E75;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:#444}'
    + '.tags span{display:inline-block;background:#E1F5EE;color:#0F6E56;padding:2px 10px;border-radius:999px;font-size:12px;margin:2px}'
    + '.footer{margin-top:32px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:16px}'
    + '</style></head><body>'
    + '<h1>New solar lead: ' + lead.fname + ' ' + lead.lname + '</h1>'
    + '<div class="sub">Submitted ' + date + '</div>'
    + '<div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">'
    + '<div class="score">' + ai.score + '<span style="font-size:16px;font-weight:400;color:#888;">/100</span></div>'
    + '<div><div class="badge">' + ai.tier + ' lead</div>'
    + '<div style="font-size:13px;color:#666;margin-top:4px;">Priority: ' + ai.priority + '</div></div></div>'
    + '<div class="grid">'
    + '<div class="metric"><div class="label">System size</div><div class="value">' + ai.estimatedSystemSize + '</div></div>'
    + '<div class="metric"><div class="label">Panels</div><div class="value">' + ai.estimatedPanels + ' panels</div></div>'
    + '<div class="metric"><div class="label">Battery storage</div><div class="value">' + ai.estimatedBatteries + '</div></div>'
    + '<div class="metric"><div class="label">Est. payback ROI</div><div class="value">' + ai.estimatedROI + '</div></div>'
    + '</div>'
    + '<div class="section"><h2>Engineer notes</h2>'
    + '<div class="notes">' + ai.engineerNotes + '</div>'
    + '<div class="tags" style="margin-top:10px;">' + tags + '</div></div>'
    + '<div class="section"><h2>Client details</h2>'
    + '<div class="row"><span class="key">Name</span><span class="val">' + lead.fname + ' ' + lead.lname + '</span></div>'
    + '<div class="row"><span class="key">Email</span><span class="val">' + lead.email + '</span></div>'
    + '<div class="row"><span class="key">Phone</span><span class="val">' + lead.phone + '</span></div>'
    + '<div class="row"><span class="key">Address</span><span class="val">' + lead.address + '</span></div></div>'
    + '<div class="section"><h2>Energy profile</h2>'
    + '<div class="row"><span class="key">Monthly bill</span><span class="val">' + lead.bill + '</span></div>'
    + '<div class="row"><span class="key">Monthly usage</span><span class="val">' + lead.usage + '</span></div>'
    + '<div class="row"><span class="key">Provider</span><span class="val">' + (lead.provider || 'N/A') + '</span></div>'
    + '<div class="row"><span class="key">Roof type</span><span class="val">' + roofTypes + '</span></div>'
    + '<div class="row"><span class="key">Orientation</span><span class="val">' + lead.orientation + '</span></div>'
    + '<div class="row"><span class="key">Roof area</span><span class="val">' + (lead.roofArea || 'N/A') + ' m2</span></div>'
    + '<div class="row"><span class="key">Goals</span><span class="val">' + goals + '</span></div>'
    + '<div class="row"><span class="key">Timeline</span><span class="val">' + lead.timeline + '</span></div></div>'
    + clientNotes
    + '<div class="footer">Generated by Solar Lead Generator &middot; Powered by Gemini AI</div>'
    + '</body></html>';

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'leads@yourdomain.com',
    to: process.env.ENGINEER_EMAIL,
    subject: '[' + ai.tier + ' Lead] ' + lead.fname + ' ' + lead.lname + ' — Score ' + ai.score + '/100',
    html
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  const leadData = req.body;
  try {
    const ai = await scoreLead(leadData);

    const { data: saved, error } = await supabase
      .from('leads')
      .insert({
        fname:             leadData.fname,
        lname:             leadData.lname,
        email:             leadData.email,
        phone:             leadData.phone,
        address:           leadData.address,
        roof_types:        leadData.roofTypes || [],
        orientation:       leadData.orientation,
        roof_area:         parseFloat(leadData.roofArea) || null,
        bill:              leadData.bill,
        usage:             leadData.usage,
        provider:          leadData.provider,
        goals:             leadData.goals || [],
        timeline:          leadData.timeline,
        notes:             leadData.notes,
        ai_score:          ai.score,
        ai_tier:           ai.tier,
        ai_system_size:    ai.estimatedSystemSize,
        ai_panels:         ai.estimatedPanels,
        ai_batteries:      ai.estimatedBatteries,
        ai_roi:            ai.estimatedROI,
        ai_priority:       ai.priority,
        ai_engineer_notes: ai.engineerNotes,
        ai_tags:           ai.tags || []
      })
      .select()
      .single();

    if (error) throw error;

    sendEngineerEmail(leadData, ai).catch(err =>
      console.warn('Email failed (non-fatal):', err.message)
    );

    res.json({ success: true, lead: saved, ai });
  } catch (err) {
    console.error('Lead submission error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Solar Lead Gen running on http://localhost:' + PORT));
