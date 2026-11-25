const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(
  'const sessionsSnap = await getDocs(sessionsQuery);',
  `const sessionsSnap = await getDocs(sessionsQuery);
        console.log("[DASHBOARD_METRICS] período selecionado: Últimos 7 dias");
        console.log(\`[DASHBOARD_METRICS] sessões carregadas: \${sessionsSnap.size}\`);`
);

code = code.replace(
  'const eventsSnap = await getDocs(eventsQuery);',
  `const eventsSnap = await getDocs(eventsQuery);
        console.log(\`[DASHBOARD_METRICS] eventos carregados: \${eventsSnap.size}\`);`
);

code = code.replace(
  'const ordersSnap = await getDocs(ordersQuery);',
  `const ordersSnap = await getDocs(ordersQuery);
        console.log(\`[DASHBOARD_METRICS] pedidos carregados: \${ordersSnap.size}\`);`
);

code = code.replace(
  'setLoading(false);',
  `console.log(\`[DASHBOARD_METRICS] faturamento calculado: \${totalRevenue}\`);
        console.log("[DASHBOARD_METRICS] funil calculado", {
          sessions: sessionsCount,
          buyClick: uniqueEventsBySession.cta_buy_click.size,
          checkoutStart: uniqueEventsBySession.checkout_started.size,
          dataSubmitted: uniqueEventsBySession.customer_data_submitted.size,
          shippingFilled: uniqueEventsBySession.checkout_shipping_filled.size,
          paymentSelected: uniqueEventsBySession.payment_method_selected.size,
          pixGenerated: uniqueEventsBySession.pix_generated.size,
          orderCreated: totalOrders,
          orderPaid: paidOrdersCount
        });
        setLoading(false);`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
