const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

const productsTarget = `    // Products
    match /products/{productId} {
      allow get: if (resource != null && resource.data.projectId == 'anailda-book' && resource.data.status == 'active') || isAdmin();
      allow list: if isAdmin();
      allow create, update, delete: if isAdmin();
    }`;

const productsReplacement = `    // Products
    match /products/{productId} {
      allow get: if (
        resource != null &&
        resource.data.projectId == 'anailda-book' &&
        resource.data.status == 'active'
      ) || isAdmin();

      allow list: if (
        resource != null &&
        resource.data.projectId == 'anailda-book' &&
        resource.data.status == 'active'
      ) || isAdmin();

      allow create, update, delete: if isAdmin();
    }`;

const ordersTarget = `      match /orders/{orderId} {
        // Only admin can read orders (no public read)
        allow read: if isAdmin();
        
        // Public can create pending orders only
        allow create: if projectId == 'anailda-book'
                      && request.resource.data.productId != null
                      && request.resource.data.amount is number
                      && request.resource.data.amount > 0
                      && request.resource.data.currency == 'BRL'
                      && request.resource.data.paymentStatus == 'pending'
                      && (request.resource.data.status == 'created' || request.resource.data.status == 'pending');
        
        allow update, delete: if isAdmin();
      }`;

const ordersReplacement = `      match /orders/{orderId} {
        // Only admin can read orders (no public read)
        allow read: if isAdmin();
        
        // Public can create pending orders only
        allow create: if projectId == 'anailda-book'
                      && request.resource.data.amount is number
                      && request.resource.data.amount > 0
                      && request.resource.data.currency == 'BRL'
                      && request.resource.data.paymentStatus == 'pending'
                      && (request.resource.data.status == 'created' || request.resource.data.status == 'pending')
                      && (
                        request.resource.data.keys().hasAny(['productId']) ||
                        request.resource.data.keys().hasAny(['items'])
                      );
        
        allow update, delete: if isAdmin();
      }`;

code = code.replace(productsTarget, productsReplacement);
code = code.replace(ordersTarget, ordersReplacement);

fs.writeFileSync('firestore.rules', code);
