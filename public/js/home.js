/**
 * Home page: everything is painted from ONE call to GET /api/home.
 *
 *   logged out → latest products + total count, Login button
 *   logged in  → the same, plus cart badge/tile and (only when > 0) the
 *                orders tile; expired tokens are refreshed transparently
 *                by Api.apiFetch, and a dead session falls back to the
 *                guest view instead of an error page.
 */
(function () {
    const $ = (id) => document.getElementById(id);

    const money = (value) => {
        const n = Number(value);
        return Number.isFinite(n)
            ? n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
            : value;
    };

    // CSP allows data: images — neutral placeholder for products without one.
    const PLACEHOLDER =
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">' +
                '<rect width="400" height="300" fill="#eef1f6"/>' +
                '<path d="M160 190l40-50 35 42 25-28 40 36H160z" fill="#c3ccd9"/>' +
                '<circle cx="185" cy="115" r="18" fill="#c3ccd9"/></svg>',
        );

    const productCard = (product) => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const img = document.createElement('img');
        img.className = 'product-image';
        img.alt = product.product_name;
        img.src = product.image || PLACEHOLDER;
        img.onerror = () => {
            img.onerror = null;
            img.src = PLACEHOLDER;
        };

        const info = document.createElement('div');
        info.className = 'product-info';

        if (product.category?.category_name) {
            const chip = document.createElement('span');
            chip.className = 'category-chip';
            chip.textContent = product.category.category_name;
            info.appendChild(chip);
        }

        const name = document.createElement('h3');
        name.className = 'product-name';
        name.textContent = product.product_name;
        info.appendChild(name);

        const price = document.createElement('p');
        price.className = 'product-price';
        price.textContent = money(product.price);
        info.appendChild(price);

        card.append(img, info);
        return card;
    };

    const renderHeader = (user) => {
        $('guest-actions').hidden = Boolean(user);
        $('user-actions').hidden = !user;
        if (user) {
            $('user-name').textContent = `Hi, ${user.first_name}`;
            $('cart-count').textContent = user.cart_count;
        }
    };

    const renderStats = (data) => {
        $('total-products').textContent = data.total_products;

        const user = data.user;
        $('cart-stat').hidden = !user;
        if (user) $('cart-stat-count').textContent = user.cart_count;

        // Orders tile only when orders actually exist for this user.
        const hasOrders = Boolean(user) && user.order_count > 0;
        $('order-stat').hidden = !hasOrders;
        if (hasOrders) $('order-stat-count').textContent = user.order_count;
    };

    const renderProducts = (products) => {
        const grid = $('product-grid');
        grid.replaceChildren(...products.map(productCard));
        $('no-products').hidden = products.length > 0;
        $('latest-hint').textContent = products.length
            ? `Showing the ${products.length} newest of the catalog`
            : '';
    };

    const render = (data) => {
        renderHeader(data.user);
        if (data.user) $('hero-title').textContent = `Welcome back, ${data.user.first_name}!`;
        renderStats(data);
        renderProducts(data.latest_products);
        $('page-state').hidden = true;
        $('home-content').hidden = false;
    };

    const loadHome = async () => {
        const { res, body } = await Api.apiFetch('/api/home');

        if (res.ok) return render(body.data);

        // Auth failed and apiFetch already dropped the tokens — the page
        // is still fully usable as a guest, so just re-request without them.
        if (res.status === 401 || res.status === 403) {
            const retry = await Api.apiFetch('/api/home');
            if (retry.res.ok) return render(retry.body.data);
        }

        $('page-state').textContent = 'Could not load the home page. Is the API running?';
        $('page-state').classList.add('error');
    };

    $('logout-btn').addEventListener('click', async () => {
        await Api.logout();
        window.location.reload();
    });

    loadHome().catch(() => {
        $('page-state').textContent = 'Could not load the home page. Is the API running?';
        $('page-state').classList.add('error');
    });
})();
