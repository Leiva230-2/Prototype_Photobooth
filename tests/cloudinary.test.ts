import { describe, expect, it } from 'vitest';
import { attachmentUrl, deliveryUrl, galleryLink, publicId } from '../src/shared/cloudinary';

describe('cloudinary urls', () => {
  it('namespaces assets by session code', () => {
    expect(publicId('7K9XPQ', 'sheet')).toBe('booth/7K9XPQ/sheet');
    expect(publicId('7K9XPQ', 'gif')).toBe('booth/7K9XPQ/anim');
  });

  it('builds delivery and attachment urls', () => {
    expect(deliveryUrl('demo', '7K9XPQ', 'story')).toBe(
      'https://res.cloudinary.com/demo/image/upload/booth/7K9XPQ/story.jpg',
    );
    expect(attachmentUrl('demo', '7K9XPQ', 'gif')).toBe(
      'https://res.cloudinary.com/demo/image/upload/fl_attachment/booth/7K9XPQ/anim.gif',
    );
  });

  it('adds the session code to the gallery url', () => {
    expect(galleryLink('https://x.com/gallery.html', 'ABCDEF')).toBe('https://x.com/gallery.html?s=ABCDEF');
    expect(galleryLink('https://x.com/g?event=binus', 'ABCDEF')).toBe('https://x.com/g?event=binus&s=ABCDEF');
  });

  it('rejects a gallery url that is not a url', () => {
    expect(() => galleryLink('gallery.html', 'ABCDEF')).toThrow();
  });
});
