import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

// Ghost wraps bookmark cards and other embeds in figure tags — convert to plain links
td.addRule('ghost-bookmark', {
  filter: node => node.nodeName === 'FIGURE' && node.classList?.contains('kg-bookmark-card'),
  replacement: (content, node) => {
    const link = node.querySelector('a.kg-bookmark-container');
    const title = node.querySelector('.kg-bookmark-title')?.textContent?.trim();
    const url = link?.getAttribute('href') || '';
    return title ? `\n\n[${title}](${url})\n\n` : `\n\n${url}\n\n`;
  },
});

// Ghost callout cards — convert to blockquote
td.addRule('ghost-callout', {
  filter: node => node.nodeName === 'DIV' && node.classList?.contains('kg-callout-card'),
  replacement: (content, node) => {
    const text = node.querySelector('.kg-callout-text')?.textContent?.trim() || '';
    return `\n\n> ${text}\n\n`;
  },
});

export function htmlToMarkdown(html) {
  if (!html) return '';
  return td.turndown(html).trim();
}

export function htmlToPlainText(html) {
  if (!html) return '';
  // Strip all tags, collapse whitespace
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build a site.standard.document record from a Ghost post object.
 * @param {object} post - Ghost post (from Content API or webhook payload)
 * @param {string} publicationUri - AT URI of the site.standard.publication record
 */
export function buildDocumentRecord(post, publicationUri) {
  const markdown = htmlToMarkdown(post.html || '');
  const textContent = htmlToPlainText(post.html || '');
  const tags = (post.tags || []).map(t => t.name).filter(Boolean);

  const record = {
    $type: 'site.standard.document',
    title: post.title,
    site: publicationUri,
    path: `/${post.slug}`,
    publishedAt: post.published_at,
    ...(post.updated_at && { updatedAt: post.updated_at }),
    ...(post.custom_excerpt || post.excerpt
      ? { description: post.custom_excerpt || post.excerpt }
      : {}),
    ...(tags.length > 0 && { tags }),
    ...(markdown && {
      content: {
        $type: 'site.standard.content.markdown',
        text: markdown,
        version: '1.0',
      },
      textContent,
    }),
  };

  return record;
}
