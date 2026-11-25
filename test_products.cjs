const fs = require('fs');

const code = `import React from "react";

export function Products() {
  console.log("[PRODUCTS_PAGE_TEST] componente Products renderizado");

  return (
    <div
      style={{
        padding: 40,
        background: "#fff",
        color: "#111",
        minHeight: "100vh",
        border: "6px solid red",
        position: "relative",
        zIndex: 9999
      }}
    >
      <h1>DEBUG PRODUCTS PAGE RENDERED</h1>
      <p>Se você está vendo isso, a rota /products está renderizando o componente Products.</p>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/Products.tsx', code);
