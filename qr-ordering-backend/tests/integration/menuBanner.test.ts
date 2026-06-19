import { describe, it, expect } from 'vitest';

import { api, auth, registerTenant } from '../helpers';

describe('menu banner settings', () => {
  it('saves multiple banner images and exposes them on the public menu; blanks clear to null', async () => {
    const { data } = await registerTenant();
    const token = data.token;

    const saved = await api()
      .patch('/admin/menu/settings')
      .set(auth(token))
      .send({
        bannerImageUrls: ['/uploads/banner1.jpg', '/uploads/banner2.jpg'],
        bannerTitle: "Tonight's Specials",
        bannerSubtitle: 'Fresh from the grill',
      });
    expect(saved.status).toBe(200);
    expect(saved.body.data.bannerImageUrls).toEqual([
      '/uploads/banner1.jpg',
      '/uploads/banner2.jpg',
    ]);
    expect(saved.body.data.bannerTitle).toBe("Tonight's Specials");
    expect(saved.body.data.bannerSubtitle).toBe('Fresh from the grill');

    // Exposed on the customer-facing menu as a `banner` object with an image list.
    const tables = (await api().get('/admin/tables').set(auth(token))).body.data;
    const code = tables[0].code;
    const menu = (await api().get(`/public/menu?tableCode=${code}`)).body.data;
    expect(menu.banner).toEqual({
      imageUrls: ['/uploads/banner1.jpg', '/uploads/banner2.jpg'],
      title: "Tonight's Specials",
      subtitle: 'Fresh from the grill',
    });

    // An empty list clears the images; a blank title falls back to defaults.
    const cleared = await api()
      .patch('/admin/menu/settings')
      .set(auth(token))
      .send({ bannerImageUrls: [], bannerTitle: '   ' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.bannerImageUrls).toEqual([]);
    expect(cleared.body.data.bannerTitle).toBeNull();
  });
});
