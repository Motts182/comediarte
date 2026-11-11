import { useRef, useState, type FormEvent } from 'react';
import { useData } from '../lib/data';
import { KIND_META, type Product, type ProductKind } from '../lib/types';
import { byName, fmt, moneyInput, parseMoney, stamp, uid } from '../lib/util';
import { Modal } from '../ui/Modal';
import { SyncBadge } from '../ui/SyncBadge';
import { toast } from '../ui/toast';

const KIND_NAME: Record<ProductKind, string> = { drink: 'bebida', food: 'comida' };

export function Catalog() {
  const { products, saveProduct, pending } = useData();
  const [editing, setEditing] = useState<{ product?: Product; kind: ProductKind } | null>(null);

  return (
    <div className="screen">
      <header className="topbar">
        <a className="icon-btn" href="#/" aria-label="Volver a eventos">
          ‹
        </a>
        <div className="topbar-title">
          <strong>Carta</strong>
          <span>Lo que se vende en barra y cocina</span>
        </div>
        <SyncBadge pending={pending} />
      </header>

      <main className="main">
        {(['drink', 'food'] as const).map((kind) => {
          const list = products.filter((product) => product.kind === kind).sort(byName);
          return (
            <section className="stack" key={kind}>
              <h2 className="section-title">
                {KIND_META[kind].icon} {KIND_META[kind].label}
              </h2>
              {list.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  className={`list-row${product.active ? '' : ' is-off'}`}
                  onClick={() => setEditing({ product, kind })}
                >
                  <span className="list-name">
                    {product.name}
                    {!product.active && <em> · oculto</em>}
                  </span>
                  <strong>{fmt(product.price)}</strong>
                  <span className="chev" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
              <button type="button" className="btn btn-ghost" onClick={() => setEditing({ kind })}>
                + Añadir {KIND_NAME[kind]}
              </button>
            </section>
          );
        })}
      </main>

      {editing && (
        <ProductForm
          product={editing.product}
          kind={editing.kind}
          onSave={saveProduct}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface ProductFormProps {
  product?: Product;
  kind: ProductKind;
  onSave: (product: Product) => void;
  onClose: () => void;
}

export function ProductForm({ product, kind: initialKind, onSave, onClose }: ProductFormProps) {
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? initialKind);
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product ? moneyInput(product.price) : '');
  const [active, setActive] = useState(product?.active ?? true);
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);

  const build = (): Product | null => {
    const cents = parseMoney(price);
    if (!name.trim()) {
      setError('Escribe el nombre.');
      return null;
    }
    if (cents === null) {
      setError('Escribe un precio válido, por ejemplo 2,50.');
      return null;
    }
    return {
      id: product?.id ?? uid(),
      kind,
      name: name.trim(),
      price: cents,
      active,
      updatedAt: stamp(product),
    };
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const built = build();
    if (!built) return;
    onSave(built);
    onClose();
  };

  const saveAndNext = () => {
    const built = build();
    if (!built) return;
    onSave(built);
    toast(`Añadido: ${built.name} · ${fmt(built.price)}`);
    setName('');
    setPrice('');
    setError('');
    nameInput.current?.focus();
  };

  return (
    <Modal title={product ? 'Editar producto' : `Añadir ${KIND_NAME[kind]}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="segmented" role="group" aria-label="Tipo de producto">
          {(['drink', 'food'] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={kind === option ? 'is-active' : ''}
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {KIND_META[option].icon} {option === 'drink' ? 'Bebida' : 'Comida'}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Nombre</span>
          <input
            ref={nameInput}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'drink' ? 'Cerveza' : 'Empanada'}
            autoFocus={!product}
            autoComplete="off"
            enterKeyHint="next"
          />
        </label>

        <label className="field">
          <span>Precio</span>
          <div className="money">
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              autoComplete="off"
            />
            <span>€</span>
          </div>
        </label>

        {product && (
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Disponible para vender</span>
          </label>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions">
          {product ? (
            <button
              type="button"
              className="btn btn-ghost btn-ghost-danger"
              onClick={() => {
                onSave({ ...product, deleted: true, updatedAt: stamp(product) });
                onClose();
              }}
            >
              Eliminar
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={saveAndNext}>
              Guardar y otro
            </button>
          )}
          <button type="submit" className="btn btn-primary">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
