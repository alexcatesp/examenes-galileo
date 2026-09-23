import MarkdownIt from 'markdown-it';

// Sin HTML crudo ni enlaces: nada de lo que hay en un enunciado puede sacar al
// alumno de la página.
const md = new MarkdownIt({ html: false, linkify: false, breaks: false, typographer: false });
md.disable(['link', 'autolink']);

export const renderizar = (texto: string) => md.render(texto);
export const renderizarLinea = (texto: string) => md.renderInline(texto);
