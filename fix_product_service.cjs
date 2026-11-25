const fs = require('fs');
let code = fs.readFileSync('src/services/productService.ts', 'utf8');

code = code.replace(
  `    return { id: doc.id, ...data } as ProductData;`,
  `    return {
      ...data,
      id: doc.id,
      projectId: data.projectId || projectId,
      title: data.title || "Produto sem título",
      slug: data.slug || doc.id,
      status: data.status || "draft",
      productType: data.productType || data.type || "simple",
      originalPrice: Number(data.originalPrice) || 0,
      promotionalPrice: Number(data.promotionalPrice) || 0,
      comboItems: Array.isArray(data.comboItems) ? data.comboItems : []
    } as ProductData;`
);

fs.writeFileSync('src/services/productService.ts', code);
