import { useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Eraser, Link2, Link2Off, TextQuote, Minus, Undo2, Redo2,
  Indent, Outdent, Highlighter,
} from 'lucide-react';

/* Éditeur riche léger (contentEditable) — sortie HTML.
   Le contenu initial ne se réinjecte qu'au changement de clé (modèle ou
   document), ce qui préserve le curseur pendant la frappe. */

const BLOCS = [
  { id: 'p', libelle: 'Paragraphe' },
  { id: 'h1', libelle: 'Titre 1' },
  { id: 'h2', libelle: 'Titre 2' },
  { id: 'h3', libelle: 'Titre 3' },
  { id: 'blockquote', libelle: 'Citation' },
];

const boutonCls = 'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md font-courant text-[15px] font-bold text-gris-700 transition-colors duration-rapide hover:bg-gris-200';

function BoutonBarre({ libelle, onAction, children }) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      className={boutonCls}
    >
      {children}
    </button>
  );
}

export default function EditeurRiche({ valeurInitiale = '', cle = 'doc', onChanger, id = 'editeur-riche' }) {
  const ref = useRef(null);
  const [couleur, setCouleur] = useState('#b03a2e');
  const [surlignage, setSurlignage] = useState('#fbf1df');

  const executer = (cmd, arg = null) => {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      /* commande non supportée, on ignore */
    }
    onChanger(ref.current?.innerHTML ?? '');
  };

  const lien = () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return;
    const url = window.prompt('Adresse du lien (https://…)', 'https://');
    if (url && /^https?:\/\/.+\..+/.test(url.trim())) executer('createLink', url.trim());
  };

  return (
    <div className="overflow-hidden rounded-md border border-gris-300 bg-gris-0 focus-within:border-digi">
      <div role="toolbar" aria-label="Mise en forme" className="flex flex-wrap items-center gap-esp-1 border-b border-gris-300 bg-gris-100 p-esp-2">
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <BoutonBarre libelle="Annuler" onAction={() => executer('undo')}><Undo2 size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Rétablir" onAction={() => executer('redo')}><Redo2 size={20} aria-hidden="true" /></BoutonBarre>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <select
            aria-label="Style de paragraphe"
            title="Style de paragraphe"
            onChange={(e) => executer('formatBlock', e.target.value)}
            defaultValue="p"
            className="h-11 min-h-[44px] rounded-md border border-gris-300 bg-gris-0 px-esp-2 font-courant text-[14px] font-semibold text-gris-700"
          >
            {BLOCS.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}
          </select>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <BoutonBarre libelle="Gras" onAction={() => executer('bold')}><Bold size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Italique" onAction={() => executer('italic')}><Italic size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Souligné" onAction={() => executer('underline')}><Underline size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Barré" onAction={() => executer('strikeThrough')}><Strikethrough size={20} aria-hidden="true" /></BoutonBarre>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <label title="Couleur du texte" aria-label="Couleur du texte" className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md hover:bg-gris-200">
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-sm border border-gris-400 font-titrage text-[14px] font-extrabold" style={{ color: couleur }}>A</span>
            <input type="color" value={couleur} onChange={(e) => { setCouleur(e.target.value); executer('foreColor', e.target.value); }} className="sr-only" />
          </label>
          <label title="Surlignage" aria-label="Surlignage" className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-md hover:bg-gris-200">
            <Highlighter size={20} aria-hidden="true" style={{ color: surlignage === '#fbf1df' ? undefined : surlignage }} />
            <input type="color" value={surlignage} onChange={(e) => { setSurlignage(e.target.value); executer('hiliteColor', e.target.value); }} className="sr-only" />
          </label>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <BoutonBarre libelle="Puces" onAction={() => executer('insertUnorderedList')}><List size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Numéros" onAction={() => executer('insertOrderedList')}><ListOrdered size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Retrait" onAction={() => executer('indent')}><Indent size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Réduire le retrait" onAction={() => executer('outdent')}><Outdent size={20} aria-hidden="true" /></BoutonBarre>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <BoutonBarre libelle="Aligner à gauche" onAction={() => executer('justifyLeft')}><AlignLeft size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Centrer" onAction={() => executer('justifyCenter')}><AlignCenter size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Aligner à droite" onAction={() => executer('justifyRight')}><AlignRight size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Justifier" onAction={() => executer('justifyFull')}><AlignJustify size={20} aria-hidden="true" /></BoutonBarre>
        </span>
        <span className="flex items-center gap-esp-1 border-gris-300 pr-esp-1 [&:not(:last-child)]:border-r">
          <BoutonBarre libelle="Insérer un lien (sélectionnez d'abord le texte)" onAction={lien}><Link2 size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Retirer le lien" onAction={() => executer('unlink')}><Link2Off size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Citation" onAction={() => executer('formatBlock', 'blockquote')}><TextQuote size={20} aria-hidden="true" /></BoutonBarre>
          <BoutonBarre libelle="Ligne de séparation" onAction={() => executer('insertHorizontalRule')}><Minus size={20} aria-hidden="true" /></BoutonBarre>
        </span>
        <span className="flex items-center gap-esp-1 pr-esp-1">
          <BoutonBarre libelle="Effacer la mise en forme" onAction={() => executer('removeFormat')}><Eraser size={20} aria-hidden="true" /></BoutonBarre>
        </span>
      </div>
      <div
        ref={ref}
        key={cle}
        id={id}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="Contenu du document"
        onInput={() => onChanger(ref.current?.innerHTML ?? '')}
        dangerouslySetInnerHTML={{ __html: valeurInitiale }}
        className="dg-doc min-h-[320px] p-esp-5 font-courant text-[17px] leading-[1.65] text-gris-700 focus:outline-none"
      />
    </div>
  );
}
