/**
 * Floating Changelog Widget
 * A floating button with badge count that expands to show changelog entries
 */

// Markdown → HTML renderer for the inline expanded view.
// Block-level parser (line-by-line) plus inline transformations. Escapes HTML
// first so user content cannot inject arbitrary tags.
function renderMarkdown(src) {
    if (!src) return '';

    const escape = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const renderInline = (s) => {
        // Inline code first so its contents aren't touched by other rules
        const codeStash = [];
        s = s.replace(/`([^`]+)`/g, (_, code) => {
            codeStash.push(code);
            return `CODE${codeStash.length - 1}`;
        });

        // Images ![alt](url)
        s = s.replace(
            /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
            '<img src="$2" alt="$1" style="max-width:100%;height:auto;border-radius:6px;margin:6px 0" />'
        );

        // Links [text](url)
        s = s.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener" style="color:var(--changerawr-primary-color,#0066ff)">$1</a>'
        );

        // Bare URLs (autolink)
        s = s.replace(
            /(^|[\s(])(https?:\/\/[^\s)<]+)/g,
            '$1<a href="$2" target="_blank" rel="noopener" style="color:var(--changerawr-primary-color,#0066ff)">$2</a>'
        );

        // Bold and italic
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
        s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

        // Strikethrough
        s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');

        // Restore inline code
        s = s.replace(/CODE(\d+)/g, (_, i) =>
            `<code style="background:#f4f4f5;padding:1px 4px;border-radius:3px;font-size:0.92em">${codeStash[+i]}</code>`);

        return s;
    };

    // Pull fenced code blocks out first, replace with placeholders.
    const codeBlocks = [];
    let text = String(src).replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        codeBlocks.push({lang, code: escape(code.replace(/\n$/, ''))});
        return `BLOCK${codeBlocks.length - 1}`;
    });

    text = escape(text);
    // Un-escape the placeholder markers so they survive
    text = text.replace(/BLOCK(\d+)/g, 'BLOCK$1');

    const lines = text.split(/\r?\n/);
    const out = [];
    let i = 0;

    const flushParagraph = (buf) => {
        if (buf.length) {
            out.push(`<p style="margin:6px 0">${renderInline(buf.join(' '))}</p>`);
            buf.length = 0;
        }
    };

    let para = [];

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Blank line: paragraph break
        if (!trimmed) {
            flushParagraph(para);
            i++;
            continue;
        }

        // Code block placeholder
        const blockMatch = trimmed.match(/^BLOCK(\d+)$/);
        if (blockMatch) {
            flushParagraph(para);
            const {code} = codeBlocks[+blockMatch[1]];
            out.push(`<pre style="background:#f4f4f5;padding:8px;border-radius:6px;overflow:auto;font-size:12px;margin:8px 0"><code>${code}</code></pre>`);
            i++;
            continue;
        }

        // Headings
        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
            flushParagraph(para);
            const level = Math.min(heading[1].length + 1, 6); // bump down 1 (h1 → h2)
            const sizes = {2: 16, 3: 15, 4: 14, 5: 13, 6: 13};
            out.push(`<h${level} style="margin:10px 0 4px;font-size:${sizes[level]}px;font-weight:600">${renderInline(heading[2])}</h${level}>`);
            i++;
            continue;
        }

        // Horizontal rule
        if (/^(\*\s*\*\s*\*+|-\s*-\s*-+|_\s*_\s*_+)$/.test(trimmed)) {
            flushParagraph(para);
            out.push('<hr style="border:none;border-top:1px solid var(--changerawr-border-color,#eaeaea);margin:10px 0" />');
            i++;
            continue;
        }

        // Blockquote (consume consecutive > lines)
        if (/^>\s?/.test(trimmed)) {
            flushParagraph(para);
            const quoteLines = [];
            while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            out.push(`<blockquote style="border-left:3px solid var(--changerawr-primary-color,#0066ff);padding:4px 10px;margin:8px 0;color:var(--changerawr-text-secondary,#666);font-style:italic">${renderInline(quoteLines.join(' '))}</blockquote>`);
            continue;
        }

        // Unordered list
        if (/^[*\-+]\s+/.test(trimmed)) {
            flushParagraph(para);
            const items = [];
            while (i < lines.length && /^[*\-+]\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[*\-+]\s+/, ''));
                i++;
            }
            out.push(`<ul style="margin:6px 0;padding-left:20px">${items.map(it => `<li style="margin:2px 0">${renderInline(it)}</li>`).join('')}</ul>`);
            continue;
        }

        // Ordered list
        if (/^\d+[.)]\s+/.test(trimmed)) {
            flushParagraph(para);
            const items = [];
            while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
                i++;
            }
            out.push(`<ol style="margin:6px 0;padding-left:20px">${items.map(it => `<li style="margin:2px 0">${renderInline(it)}</li>`).join('')}</ol>`);
            continue;
        }

        // Table — header row, separator, body rows
        if (/^\|.+\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
            flushParagraph(para);
            const headerCells = trimmed.slice(1, -1).split('|').map(c => c.trim());
            i += 2;
            const rows = [];
            while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
                rows.push(lines[i].trim().slice(1, -1).split('|').map(c => c.trim()));
                i++;
            }
            const thead = `<thead><tr>${headerCells.map(c => `<th style="padding:6px 8px;border-bottom:2px solid var(--changerawr-border-color,#eaeaea);text-align:left;font-weight:600">${renderInline(c)}</th>`).join('')}</tr></thead>`;
            const tbody = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:6px 8px;border-bottom:1px solid var(--changerawr-border-color-light,#f5f5f5)">${renderInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
            out.push(`<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:12px">${thead}${tbody}</table>`);
            continue;
        }

        // Default: accumulate into paragraph buffer
        para.push(trimmed);
        i++;
    }

    flushParagraph(para);

    return out.join('');
}

class ChangelogFloatingWidget {
    constructor(container, options) {
        this.container = container;
        this.options = {
            theme: 'light',
            position: 'bottom-right',
            maxEntries: 5,
            customCSS: null,
            buttonText: "Novidades",
            showBadge: true,
            ...options
        };

        this.isOpen = false;
        this.isLoading = false;
        this.unreadCount = 0;
        this.entries = [];
        this.project = null;
        this.baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';

        this.init();
    }

    async loadStyles() {
        // Load core CSS files
        const cssFiles = [
            '/widgets/core/styles/variables.css',
            '/widgets/core/styles/reset.css',
            '/widgets/core/styles/common.css',
            '/widgets/core/styles/floating.css'
        ];

        for (const file of cssFiles) {
            const href = this.baseUrl + file;
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            }
        }

        // Inject custom CSS if provided
        if (this.options.customCSS) {
            const styleId = `changerawr-custom-css-${this.options.projectId || 'default'}`;
            let customStyle = document.getElementById(styleId);

            if (!customStyle) {
                customStyle = document.createElement('style');
                customStyle.id = styleId;
                document.head.appendChild(customStyle);
            }

            customStyle.textContent = this.options.customCSS;
        }
    }

    async init() {
        await this.loadStyles();

        // Setup container
        this.container.classList.add('changerawr-widget', 'changerawr-floating');

        if (this.options.theme === 'dark') {
            this.container.classList.add('changerawr-theme-dark');
        }

        this.container.classList.add(`changerawr-position-${this.options.position}`);
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Atualizações do changelog');

        this.render();
        await this.loadEntries();
        this.attachEventListeners();
    }

    render() {
        // Clear container
        this.container.innerHTML = '';

        // Create button wrapper with relative positioning
        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'changerawr-floating-wrapper';
        buttonWrapper.style.position = 'relative';
        buttonWrapper.style.display = 'inline-block';

        // Create floating button
        const button = document.createElement('button');
        button.className = 'changerawr-floating-button';
        button.type = 'button';
        button.setAttribute('aria-label', 'Abrir changelog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'dialog');

        // Button content
        const buttonContent = document.createElement('div');
        buttonContent.className = 'changerawr-floating-button-content';
        buttonContent.style.display = 'flex';
        buttonContent.style.alignItems = 'center';
        buttonContent.style.gap = '8px';

        const icon = document.createElement('span');
        icon.className = 'changerawr-floating-icon';
        icon.innerHTML = '📰';
        icon.style.fontSize = '1.2em';
        icon.style.flexShrink = '0';

        const text = document.createElement('span');
        text.className = 'changerawr-floating-text';
        text.textContent = this.options.buttonText;
        text.style.whiteSpace = 'nowrap';

        buttonContent.appendChild(icon);
        buttonContent.appendChild(text);
        button.appendChild(buttonContent);

        // Badge
        if (this.options.showBadge) {
            const badge = document.createElement('span');
            badge.className = 'changerawr-floating-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = '0';
            badge.style.display = 'none';
            button.appendChild(badge);
        }

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'changerawr-floating-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Entradas do changelog');
        panel.setAttribute('aria-hidden', 'true');
        panel.style.display = 'none';

        // Panel header
        const header = document.createElement('div');
        header.className = 'changerawr-floating-panel-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '16px';
        header.style.borderBottom = '1px solid var(--changerawr-border-color, #eaeaea)';

        const title = document.createElement('h2');
        title.className = 'changerawr-floating-panel-title';
        title.textContent = this.project?.name || 'Novidades';
        title.style.margin = '0';
        title.style.fontSize = '16px';
        title.style.fontWeight = '600';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'changerawr-floating-close-btn';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'Fechar changelog');
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.padding = '4px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.color = 'var(--changerawr-text-secondary, #666666)';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Panel content area
        const content = document.createElement('div');
        content.className = 'changerawr-floating-panel-content';
        content.style.flex = '1';
        content.style.overflowY = 'auto';
        content.style.padding = '0';

        // Panel footer
        const footer = document.createElement('div');
        footer.className = 'changerawr-floating-panel-footer';
        footer.style.padding = '12px 16px';
        footer.style.borderTop = '1px solid var(--changerawr-border-color, #eaeaea)';
        footer.style.fontSize = '12px';
        footer.style.color = 'var(--changerawr-text-secondary, #666666)';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';
        footer.style.gap = '12px';

        const poweredBy = document.createElement('span');
        poweredBy.innerHTML = 'Powered by <a href="https://github.com/supernova3339/changerawr" target="_blank" rel="noopener" style="color: inherit; text-decoration: none;">Changerawr</a>';

        const rssLink = document.createElement('a');
        rssLink.href = `${this.baseUrl}/changelog/${this.options.projectId}/rss.xml`;
        rssLink.textContent = 'RSS';
        rssLink.target = '_blank';
        rssLink.rel = 'noopener';
        rssLink.style.color = 'inherit';
        rssLink.style.textDecoration = 'none';

        footer.appendChild(poweredBy);
        footer.appendChild(rssLink);

        // Assemble panel
        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        // Assemble button wrapper
        buttonWrapper.appendChild(button);
        buttonWrapper.appendChild(panel);

        // Add to container
        this.container.appendChild(buttonWrapper);

        // Store references
        this.button = button;
        this.panel = panel;
        this.panelContent = content;
        this.badge = button.querySelector('.changerawr-floating-badge');
        this.closeBtn = closeBtn;
    }

    attachEventListeners() {
        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });

        this.closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.button.contains(e.target) && !this.panel.contains(e.target)) {
                this.close();
            }
        });
    }

    async loadEntries() {
        this.isLoading = true;

        try {
            const response = await fetch(
                `${this.baseUrl}/api/changelog/${this.options.projectId}/entries`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.entries = data.items || [];
            this.project = data.project;

            // Calculate unread count (entries from last 7 days)
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            this.unreadCount = this.entries.filter(entry => {
                const entryDate = new Date(entry.createdAt).getTime();
                return entryDate > weekAgo;
            }).length;

            this.updateBadge();
        } catch (error) {
            console.error('Failed to load changelog entries:', error);
            this.unreadCount = 0;
        } finally {
            this.isLoading = false;
        }
    }

    updateBadge() {
        if (!this.badge) return;

        if (this.unreadCount > 0) {
            this.badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
            this.badge.style.display = 'flex';
        } else {
            this.badge.style.display = 'none';
        }
    }

    renderEntries() {
        this.panelContent.innerHTML = '';

        if (!this.entries || this.entries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'changerawr-floating-empty';
            empty.style.padding = '48px 24px';
            empty.style.textAlign = 'center';
            empty.style.color = 'var(--changerawr-text-secondary, #666666)';

            const emptyIcon = document.createElement('div');
            emptyIcon.style.fontSize = '40px';
            emptyIcon.style.marginBottom = '16px';
            emptyIcon.style.opacity = '0.5';
            emptyIcon.textContent = '📰';

            const emptyMsg = document.createElement('div');
            emptyMsg.style.fontSize = '14px';
            emptyMsg.textContent = 'Nenhuma novidade por aqui ainda';

            empty.appendChild(emptyIcon);
            empty.appendChild(emptyMsg);
            this.panelContent.appendChild(empty);
            return;
        }

        const entriesToShow = this.entries.slice(0, this.options.maxEntries);

        entriesToShow.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = 'changerawr-floating-entry';
            entryEl.style.padding = '12px 16px';
            entryEl.style.borderBottom = '1px solid var(--changerawr-border-color-light, #f5f5f5)';
            entryEl.style.transition = 'background-color 0.2s ease';

            // Tags
            if (entry.tags && entry.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.style.display = 'flex';
                tagsContainer.style.gap = '6px';
                tagsContainer.style.marginBottom = '8px';
                tagsContainer.style.flexWrap = 'wrap';

                entry.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'changerawr-floating-tag';
                    tagEl.textContent = tag.name;
                    tagEl.style.display = 'inline-block';
                    tagEl.style.padding = '3px 8px';
                    tagEl.style.fontSize = '11px';
                    tagEl.style.fontWeight = '500';
                    tagEl.style.borderRadius = '4px';
                    tagEl.style.whiteSpace = 'nowrap';

                    if (tag.color) {
                        tagEl.style.backgroundColor = tag.color + '20';
                        tagEl.style.color = tag.color;
                    } else {
                        tagEl.style.backgroundColor = 'var(--changerawr-primary-light, #e8f2ff)';
                        tagEl.style.color = 'var(--changerawr-primary-color, #0066ff)';
                    }

                    tagsContainer.appendChild(tagEl);
                });

                entryEl.appendChild(tagsContainer);
            }

            // Title
            const titleEl = document.createElement('h3');
            titleEl.className = 'changerawr-floating-entry-title';
            titleEl.textContent = entry.title;
            titleEl.style.margin = '0 0 6px 0';
            titleEl.style.fontSize = '14px';
            titleEl.style.fontWeight = '600';
            titleEl.style.color = 'var(--changerawr-text-primary, #1a1a1a)';
            titleEl.style.lineHeight = '1.4';
            entryEl.appendChild(titleEl);

            // Content
            let contentEl = null;
            if (entry.excerpt) {
                contentEl = document.createElement('p');
                contentEl.className = 'changerawr-floating-entry-content';
                contentEl.textContent = entry.excerpt;
                contentEl.style.margin = '0 0 8px 0';
                contentEl.style.fontSize = '13px';
                contentEl.style.color = 'var(--changerawr-text-secondary, #666666)';
                contentEl.style.lineHeight = '1.5';
                contentEl.style.display = '-webkit-box';
                contentEl.style.webkitLineClamp = '3';
                contentEl.style.webkitBoxOrient = 'vertical';
                contentEl.style.overflow = 'hidden';
                contentEl.style.textOverflow = 'ellipsis';
                entryEl.appendChild(contentEl);
            }

            // Expandable full-content container (hidden until "Read more" is clicked)
            const fullContentEl = document.createElement('div');
            fullContentEl.className = 'changerawr-floating-full-content';
            fullContentEl.style.display = 'none';
            fullContentEl.style.marginTop = '8px';
            fullContentEl.style.fontSize = '13px';
            fullContentEl.style.color = 'var(--changerawr-text-secondary, #444)';
            fullContentEl.style.lineHeight = '1.6';
            fullContentEl.style.whiteSpace = 'pre-wrap';
            fullContentEl.style.wordBreak = 'break-word';
            entryEl.appendChild(fullContentEl);

            // Toggle button (replaces the old external link)
            const toggleEl = document.createElement('button');
            toggleEl.type = 'button';
            toggleEl.className = 'changerawr-floating-read-more';
            toggleEl.textContent = 'Ler mais →';
            toggleEl.style.display = 'inline-block';
            toggleEl.style.marginTop = '6px';
            toggleEl.style.fontSize = '12px';
            toggleEl.style.fontWeight = '500';
            toggleEl.style.color = 'var(--changerawr-primary-color, #0066ff)';
            toggleEl.style.background = 'none';
            toggleEl.style.border = 'none';
            toggleEl.style.padding = '4px 0';
            toggleEl.style.cursor = 'pointer';
            toggleEl.style.textDecoration = 'none';

            toggleEl.addEventListener('mouseenter', () => {
                toggleEl.style.textDecoration = 'underline';
            });
            toggleEl.addEventListener('mouseleave', () => {
                toggleEl.style.textDecoration = 'none';
            });

            let expanded = false;
            let loaded = false;
            let loading = false;

            toggleEl.addEventListener('click', async (e) => {
                e.stopPropagation();

                if (loading) return;

                if (expanded) {
                    fullContentEl.style.display = 'none';
                    if (contentEl) contentEl.style.display = '';
                    toggleEl.textContent = 'Ler mais →';
                    expanded = false;
                    return;
                }

                if (!loaded) {
                    loading = true;
                    toggleEl.textContent = 'Carregando…';
                    try {
                        const res = await fetch(
                            `${this.baseUrl}/api/changelog/entries/${entry.id}`
                        );
                        if (!res.ok) throw new Error('Failed to load');
                        const data = await res.json();
                        const html = renderMarkdown(data.entry.content || '');
                        fullContentEl.innerHTML = html;
                        loaded = true;
                    } catch (err) {
                        fullContentEl.textContent = 'Não foi possível carregar esta entrada. Tente novamente.';
                    } finally {
                        loading = false;
                    }
                }

                fullContentEl.style.display = 'block';
                if (contentEl) contentEl.style.display = 'none';
                toggleEl.textContent = 'Mostrar menos ↑';
                expanded = true;
            });

            entryEl.appendChild(toggleEl);

            // Hover effect
            entryEl.addEventListener('mouseenter', () => {
                entryEl.style.backgroundColor = 'var(--changerawr-bg-hover, #f5f5f5)';
            });

            entryEl.addEventListener('mouseleave', () => {
                entryEl.style.backgroundColor = 'transparent';
            });

            this.panelContent.appendChild(entryEl);
        });
    }

    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.panel.style.display = 'flex';
        this.panel.setAttribute('aria-hidden', 'false');
        this.button.setAttribute('aria-expanded', 'true');

        // Render entries when opening
        this.renderEntries();

        // Trigger animation with a small delay
        setTimeout(() => {
            this.panel.classList.add('changerawr-floating-panel-open');
        }, 10);

        // Focus first element
        setTimeout(() => {
            const firstLink = this.panel.querySelector('a');
            if (firstLink) {
                firstLink.focus();
            }
        }, 100);
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.panel.classList.remove('changerawr-floating-panel-open');

        // Hide panel after animation
        setTimeout(() => {
            if (!this.isOpen) {
                this.panel.style.display = 'none';
                this.panel.setAttribute('aria-hidden', 'true');
            }
        }, 300);

        this.button.setAttribute('aria-expanded', 'false');
        this.button.focus();
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Export globally for browser
window.ChangerawrWidget = {
    init: (options) => {
        const container = options.container || document.getElementById('changerawr-widget');
        return new ChangelogFloatingWidget(container, options);
    }
};
