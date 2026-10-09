import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Modal, Select } from '@/components/ui';
import {
  DropdownOption, OptionCategory, addOption, deleteOption, getCachedOptions, loadOptions, moveOption, renameOption, subscribeOptions,
} from '@/services/options';

const ADD = '__add_new__';

export function useOptions(category: OptionCategory) {
  const [options, setOptions] = useState<DropdownOption[]>(getCachedOptions(category) ?? []);
  const [loading, setLoading] = useState(!getCachedOptions(category));
  useEffect(() => {
    let alive = true;
    const unsub = subscribeOptions(category, (o) => alive && setOptions(o));
    loadOptions(category).then((o) => alive && setOptions(o)).catch(() => {}).finally(() => alive && setLoading(false));
    return () => { alive = false; unsub(); };
  }, [category]);
  return { options, loading };
}

/**
 * A dropdown whose choices the admin can customise. Users who may edit
 * (canManage) get "+ Add new…" inside the list and a gear button to rename,
 * reorder or delete choices. Existing values that are no longer in the list
 * stay selectable so old records are never silently changed.
 */
export function OptionSelect({
  category, value, onChange, canManage = false, placeholder = 'Select…', title, disabled, allowEmpty = true,
}: {
  category: OptionCategory; value: string; onChange: (v: string) => void; canManage?: boolean;
  placeholder?: string; title?: string; disabled?: boolean; allowEmpty?: boolean;
}) {
  const { options } = useOptions(category);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState(false);

  const labels = options.map((o) => o.label);
  const legacy = value && !labels.some((l) => l.toLowerCase() === value.toLowerCase()) ? value : null;

  async function submitNew() {
    setBusy(true);
    try {
      const o = await addOption(category, draft);
      onChange(o.label);
      setDraft(''); setAdding(false);
      toast.success('Option added.');
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <Input autoFocus aria-label="New option name" placeholder="Type a new option" value={draft} maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNew(); } if (e.key === 'Escape') setAdding(false); }} />
        <Button type="button" size="sm" disabled={busy || !draft.trim()} onClick={submitNew} aria-label="Save option"><Check size={14} /></Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => { setAdding(false); setDraft(''); }} aria-label="Cancel"><X size={14} /></Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Select aria-label={title ?? placeholder} value={value} disabled={disabled}
          onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}>
          {allowEmpty && <option value="">{placeholder}</option>}
          {legacy && <option value={legacy}>{legacy}</option>}
          {options.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
          {canManage && <option value={ADD}>＋ Add new…</option>}
        </Select>
        {canManage && (
          <Button type="button" size="sm" variant="secondary" aria-label="Manage options" title="Manage options" onClick={() => setManaging(true)}>
            <Settings2 size={14} />
          </Button>
        )}
      </div>
      {managing && <ManageOptionsModal category={category} title={title ?? placeholder} onClose={() => setManaging(false)} />}
    </>
  );
}

function ManageOptionsModal({ category, title, onClose }: { category: OptionCategory; title: string; onClose: () => void }) {
  const { options } = useOptions(category);
  const [editId, setEditId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [newText, setNewText] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Manage: ${title}`}>
      <p className="mb-3 text-xs text-slate-500">Changes apply to the dropdown only. Records already saved keep their current text.</p>
      <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5">
            {editId === o.id ? (
              <>
                <Input autoFocus value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') run(async () => { await renameOption(category, o.id, text); setEditId(null); }); }} />
                <Button size="sm" disabled={busy} onClick={() => run(async () => { await renameOption(category, o.id, text); setEditId(null); })} aria-label="Save"><Check size={14} /></Button>
                <Button size="sm" variant="secondary" onClick={() => setEditId(null)} aria-label="Cancel"><X size={14} /></Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-800">{o.label}</span>
                <Button size="sm" variant="ghost" disabled={busy || i === 0} aria-label="Move up" onClick={() => run(() => moveOption(category, o.id, -1))}><ArrowUp size={14} /></Button>
                <Button size="sm" variant="ghost" disabled={busy || i === options.length - 1} aria-label="Move down" onClick={() => run(() => moveOption(category, o.id, 1))}><ArrowDown size={14} /></Button>
                <Button size="sm" variant="ghost" aria-label={`Rename ${o.label}`} onClick={() => { setEditId(o.id); setText(o.label); }}><Pencil size={14} /></Button>
                <Button size="sm" variant="ghost" disabled={busy} aria-label={`Delete ${o.label}`}
                  onClick={() => { if (window.confirm(`Delete "${o.label}" from this list?`)) run(() => deleteOption(category, o.id), 'Option deleted.'); }}><Trash2 size={14} className="text-red-600" /></Button>
              </>
            )}
          </li>
        ))}
        {!options.length && <li className="py-4 text-center text-sm text-slate-400">No options yet. Add the first one below.</li>}
      </ul>
      <div className="mt-4 flex gap-2">
        <Input aria-label="New option" placeholder="Add a new option" value={newText} maxLength={120} onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newText.trim()) run(async () => { await addOption(category, newText); setNewText(''); }); }} />
        <Button disabled={busy || !newText.trim()} onClick={() => run(async () => { await addOption(category, newText); setNewText(''); })}><Plus size={14} /> Add</Button>
      </div>
      <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={onClose}>Done</Button></div>
    </Modal>
  );
}
