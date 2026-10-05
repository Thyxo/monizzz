'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Tags, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useCategories, useOnline } from '@/lib/queries';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/icons';
import { CategoryIcon, ConfirmSheet, Empty, Header, IconButton, Segmented, Sheet, SkeletonList } from '@/components/app/ui';

type Kind = 'expense' | 'income';
type Draft = { id?: string; name: string; color: string; icon: string };

export default function CategoriesView() {
  const { categories, isPending } = useCategories();
  const online = useOnline();
  const [kind, setKind] = useState<Kind>('expense');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = categories.filter((category) => category.kind === kind);
  const close = () => {
    setDraft(null);
    setConfirmDelete(false);
  };

  const save = useAction(
    (d: Draft) =>
      d.id
        ? api.categories.update({ id: d.id, name: d.name.trim(), color: d.color, icon: d.icon })
        : api.categories.create({ name: d.name.trim(), kind, color: d.color, icon: d.icon }),
    { onDone: close },
  );
  const remove = useAction((id: string) => api.categories.delete(id), { success: 'Kategori slettet', onDone: close });
  // Swaps two neighbours by giving them their list positions as sortOrder.
  const move = useAction(async ({ index, direction }: { index: number; direction: -1 | 1 }) => {
    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(index + direction, 0, item);
    await Promise.all(
      reordered.map((category, position) =>
        category.sortOrder === position ? null : api.categories.update({ id: category.id, sortOrder: position }),
      ),
    );
  });

  const startNew = () =>
    setDraft({ name: '', color: CATEGORY_COLORS[list.length % CATEGORY_COLORS.length], icon: 'tag' });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Header title="Kategorier" right={<IconButton icon={Plus} label="Ny kategori" accent disabled={!online} onClick={startNew} />} />
      <div className="shrink-0 px-4 pb-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Udgifter' },
            { value: 'income', label: 'Indtægter' },
          ]}
        />
      </div>

      <div className="scroll-area px-4 pb-6">
        {isPending ? (
          <SkeletonList rows={4} />
        ) : list.length === 0 ? (
          <Empty
            icon={Tags}
            title={kind === 'expense' ? 'Ingen udgiftskategorier' : 'Ingen indtægtskategorier'}
            text="Kategorier gør det nemt at se, hvad pengene går til. Giv dem en farve og et ikon."
            action={<button className="btn btn-accent" disabled={!online} onClick={startNew}>Opret din første kategori</button>}
          />
        ) : (
          <div className="space-y-2">
            {list.map((category, index) => (
              <div key={category.id} className="card flex items-center gap-3 p-3">
                <button
                  className="pressable flex min-w-0 flex-1 items-center gap-3 text-left"
                  disabled={!online}
                  style={{ opacity: 1 }}
                  onClick={() => setDraft({ id: category.id, name: category.name, color: category.color, icon: category.icon })}
                >
                  <CategoryIcon category={category} />
                  <span className="truncate text-sm font-semibold">{category.name}</span>
                </button>
                <button
                  aria-label="Flyt op"
                  className="pressable p-1.5"
                  style={{ color: 'var(--fg-muted)' }}
                  disabled={index === 0 || move.isPending || !online}
                  onClick={() => move.mutate({ index, direction: -1 })}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  aria-label="Flyt ned"
                  className="pressable p-1.5"
                  style={{ color: 'var(--fg-muted)' }}
                  disabled={index === list.length - 1 || move.isPending || !online}
                  onClick={() => move.mutate({ index, direction: 1 })}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={Boolean(draft)} onClose={close} title={draft?.id ? 'Rediger kategori' : 'Ny kategori'}>
        {draft && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CategoryIcon category={draft} size={48} />
              <input
                className="field"
                placeholder="Navn (f.eks. Mad)"
                maxLength={60}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>

            <div>
              <p className="label mb-2">Farve</p>
              <div className="grid grid-cols-7 gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    aria-label={`Farve ${color}`}
                    onClick={() => setDraft({ ...draft, color })}
                    className="pressable aspect-square rounded-full"
                    style={{
                      backgroundColor: color,
                      outline: draft.color === color ? '3px solid var(--fg)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="label mb-2">Ikon</p>
              <div className="grid grid-cols-7 gap-2">
                {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
                  const active = draft.icon === name;
                  return (
                    <button
                      key={name}
                      aria-label={`Ikon ${name}`}
                      onClick={() => setDraft({ ...draft, icon: name })}
                      className="pressable flex aspect-square items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: active ? draft.color : 'var(--card)',
                        color: active ? '#fff' : 'var(--fg)',
                      }}
                    >
                      <Icon size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              {draft.id && (
                <button aria-label="Slet kategori" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={18} />
                </button>
              )}
              <button className="btn btn-accent flex-1" disabled={!draft.name.trim() || save.isPending} onClick={() => save.mutate(draft)}>
                Gem
              </button>
            </div>

            <ConfirmSheet
              open={confirmDelete}
              onClose={() => setConfirmDelete(false)}
              title="Slet kategori?"
              text="Transaktioner i kategorien slettes ikke. De bliver stående som ukategoriserede."
              confirmLabel="Slet"
              busy={remove.isPending}
              onConfirm={() => draft.id && remove.mutate(draft.id)}
            />
          </div>
        )}
      </Sheet>
    </div>
  );
}
