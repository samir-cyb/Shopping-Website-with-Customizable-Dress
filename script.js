// ============================================
// DREAM FASHION HOUSE - MAIN JAVASCRIPT (FIXED VERSION)
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://hnvljwpilztzkofaqevj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhudmxqd3BpbHp0emtvZmFxZXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTc3NTYsImV4cCI6MjA4OTE3Mzc1Nn0.fycxsSksUvuF9u_T4teDUZRXjbEWMBP-PdwcqKpGUNU';

// Create Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    user: null,
    cart: [],
    currentCategory: null,
    categories: [],
    products: [],
    orders: [],
    isAdmin: false,
    customization: {
        kurtaImage: 'w1.png',
        designImage: 'Punjabi Kurta Neck Free Embroidery Design, Free Panjabi Embrodiery Design (73)-Photoroom.png',
        designPosition: 0,
        designPositionX: 50,
        designSize: 35,
        fabric: 'cotton'
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await checkUser();
    await loadCategories();
    await loadFeaturedProducts();
    setupEventListeners();
    updatePriceEstimate();
    updateDesignTransform();
});

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('cartSidebar');
        const cartBtn = document.getElementById('cartBtn');
        if (sidebar && sidebar.classList.contains('active')) {
            if (!sidebar.contains(e.target) && !cartBtn.contains(e.target)) {
                toggleCart(false);
            }
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');
    if (mobileMenu && navLinks) {
        mobileMenu.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                if (navLinks) navLinks.classList.remove('open');
            }
        });
    });

    const fabricSelect = document.getElementById('fabricSelect');
    if (fabricSelect) {
        fabricSelect.addEventListener('change', updatePriceEstimate);
    }
}

// ============================================
// AUTHENTICATION (FIXED VERSION)
// ============================================

// HARDCODED ADMIN CHECK
function checkIsAdmin(email) {
    return email === 'redwansamir90@gmail.com';
}

async function checkUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error) {
        console.error('Auth error:', error);
    }

    state.user = user;

    if (user) {
        console.log('User found:', user.email);
        
        // Check admin by email (HARDCODED)
        state.isAdmin = checkIsAdmin(user.email);
        
        // Try to fetch or create profile
        let { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Profile fetch error:', profileError);
            
            // If no profile, create one manually as fallback
            if (profileError.code === 'PGRST116' || profileError.message.includes('0 rows')) {
                console.log('Creating missing profile...');
                const { data: newProfile, error: insertError } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata?.name || user.email.split('@')[0],
                        phone_number: user.user_metadata?.phone || '',
                        address: user.user_metadata?.address || '',
                        is_admin: state.isAdmin
                    }])
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Profile creation error:', insertError);
                } else {
                    profile = newProfile;
                    console.log('Profile created:', newProfile);
                }
            }
        }

        if (profile) {
            // Ensure is_admin matches hardcoded check
            if (state.isAdmin && !profile.is_admin) {
                // Update to make admin in DB too
                await supabaseClient
                    .from('profiles')
                    .update({ is_admin: true })
                    .eq('id', user.id);
            }
            
            updateUIForUser(profile);
            await loadOrders();
        } else {
            // No profile but user exists - update UI anyway
            updateUIForUser({
                email: user.email,
                name: user.user_metadata?.name || 'User',
                is_admin: state.isAdmin
            });
        }
    } else {
        // Reset UI for logged out state
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.textContent = 'Login';
            authBtn.onclick = showAuthModal;
        }
    }
}

function updateUIForUser(profile) {
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    if (state.isAdmin) {
        authBtn.textContent = 'Admin';
        authBtn.onclick = showAdminModal;
        showToast('Welcome, Admin!', 'success');
    } else {
        authBtn.textContent = profile?.name || 'My Account';
        authBtn.onclick = () => {
            document.getElementById('orders').scrollIntoView({ behavior: 'smooth' });
        };
    }
}

// FIXED LOGIN FUNCTION
async function handleLogin() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    console.log('Attempting login:', email);

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ 
            email, 
            password 
        });

        if (error) {
            console.error('Login error:', error);
            showToast(error.message, 'error');
            return;
        }

        if (data.user) {
            console.log('Login successful:', data.user.email);
            closeAuthModal();
            showToast('Welcome back!', 'success');
            await checkUser();
            
            // If admin, show admin panel
            if (checkIsAdmin(data.user.email)) {
                setTimeout(() => showAdminModal(), 500);
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        showToast('Login failed. Please try again.', 'error');
    }
}

// FIXED REGISTRATION - No manual profile insert (trigger handles it)
async function handleRegister() {
    const name = document.getElementById('regName')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const phone = document.getElementById('regPhone')?.value.trim();
    const address = document.getElementById('regAddress')?.value.trim();
    const password = document.getElementById('regPassword')?.value;

    if (!name || !email || !phone || !address || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    console.log('Attempting registration:', email);

    try {
        // Sign up with metadata - trigger will create profile automatically
        const { data, error } = await supabaseClient.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    name: name,
                    phone: phone,
                    address: address
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            
            // Handle specific errors
            if (error.status === 429) {
                showToast('Too many attempts. Please wait 1 hour and try again.', 'error');
            } else if (error.message.includes('rate limit')) {
                showToast('Rate limit exceeded. Please try again later.', 'error');
            } else {
                showToast(error.message, 'error');
            }
            return;
        }

        if (data.user) {
            console.log('Signup successful:', data.user.email);
            console.log('User metadata:', data.user.user_metadata);
            
            closeAuthModal();
            
            // Check if email confirmation is required
            if (data.session) {
                // User is signed in immediately (email confirmation disabled)
                showToast('Account created successfully!', 'success');
                await checkUser();
            } else {
                // Email confirmation required
                showToast('Account created! Please check your email to confirm.', 'success');
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        showToast('Registration failed. Please try again.', 'error');
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    state.user = null;
    state.isAdmin = false;
    state.cart = [];
    updateCartUI();
    closeAdminModal();
    showToast('Logged out successfully', 'success');
    
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.textContent = 'Login';
        authBtn.onclick = showAuthModal;
    }
    
    const ordersList = document.getElementById('ordersList');
    if (ordersList) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <i data-lucide="package"></i>
                <p>Please login to view your orders</p>
                <button class="btn btn-primary" onclick="showAuthModal()">Login Now</button>
            </div>`;
        lucide.createIcons();
    }
}

// ============================================
// PRODUCT MANAGEMENT
// ============================================
async function loadCategories() {
    const { data, error } = await supabaseClient
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error loading categories:', error);
        return;
    }

    state.categories = data || [];
    renderCategories();
}

function renderCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    grid.innerHTML = state.categories.map(cat => `
        <div class="category-card" onclick="openCategory('${cat.id}', '${cat.name}')">
            <div class="category-icon">
                <img src="${cat.image_url}" alt="${cat.name}">
            </div>
            <h3>${cat.name}</h3>
            <p>${cat.description}</p>
        </div>
    `).join('');
}

async function loadFeaturedProducts() {
    const { data, error } = await supabaseClient
        .from('products')
        .select('*, categories(name)')
        .or('is_featured.eq.true,is_popular.eq.true')
        .limit(8);

    if (error) {
        console.error('Error loading products:', error);
        return;
    }

    state.products = data || [];
    renderFeaturedProducts();
}

function renderFeaturedProducts() {
    const grid = document.getElementById('featuredProducts');
    if (!grid) return;
    grid.innerHTML = state.products.map(product => renderProductCard(product)).join('');
    lucide.createIcons();
}

function renderProductCard(product) {
    const hasDiscount = product.discount_percent > 0;
    const finalPrice = hasDiscount
        ? product.price * (1 - product.discount_percent / 100)
        : product.price;

    const stockStatus = product.stock_quantity > 10 ? 'in-stock' :
        product.stock_quantity > 0 ? 'low-stock' : 'out';
    const stockText = product.stock_quantity > 10 ? 'In Stock' :
        product.stock_quantity > 0 ? `Only ${product.stock_quantity} Left` : 'Out of Stock';

    return `
        <div class="product-card" onclick="${product.is_customizable ? `openCustomizer('${product.id}')` : `addToCart('${product.id}')`}">
            ${hasDiscount ? `<span class="discount-badge">${product.discount_percent}% OFF</span>` : ''}
            <div class="product-image">
                <img src="${product.image_url}" alt="${product.name}" loading="lazy">
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <div class="product-price">
                    <span class="current-price">৳${finalPrice.toLocaleString()}</span>
                    ${hasDiscount ? `<span class="original-price">৳${product.price.toLocaleString()}</span>` : ''}
                </div>
                <div class="stock-info">
                    <span class="stock-dot ${stockStatus}"></span>
                    <span>${stockText}</span>
                </div>
                ${product.is_customizable ? '<div class="customize-hint"><i data-lucide="scissors"></i> Customizable</div>' : ''}
            </div>
        </div>
    `;
}

async function openCategory(categoryId, categoryName) {
    state.currentCategory = categoryId;
    const modal = document.getElementById('categoryModal');
    const titleEl = document.getElementById('categoryTitle');
    const descEl = document.getElementById('categoryDescription');
    
    if (titleEl) titleEl.textContent = categoryName;

    const cat = state.categories.find(c => c.id == categoryId);
    if (cat && descEl) descEl.textContent = cat.description || '';

    const { data: products, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('category_id', categoryId);

    if (error) {
        showToast('Error loading products', 'error');
        return;
    }

    const container = document.getElementById('categoryProducts');
    if (!products || products.length === 0) {
        if (container) container.innerHTML = '<div class="empty-state"><p>No products in this category yet.</p></div>';
    } else {
        if (container) container.innerHTML = products.map(p => renderProductCard(p)).join('');
    }

    if (modal) modal.classList.add('active');
    lucide.createIcons();
}

function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    if (modal) modal.classList.remove('active');
    state.currentCategory = null;
}

// ============================================
// 2D CUSTOMIZATION FUNCTIONS
// ============================================
function changeKurta(imageSrc, btnElement) {
    state.customization.kurtaImage = imageSrc;
    const kurtaBase = document.getElementById('kurtaBase');
    if (kurtaBase) kurtaBase.src = imageSrc;
    
    document.querySelectorAll('.kurta-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');
    updatePriceEstimate();
}

function changeDesign(designSrc, btnElement) {
    const design = document.getElementById('kurtaDesign');
    document.querySelectorAll('.design-2d-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    if (designSrc === 'none') {
        state.customization.designImage = 'none';
        if (design) design.classList.add('hidden');
    } else {
        state.customization.designImage = designSrc;
        if (design) {
            design.src = designSrc;
            design.classList.remove('hidden');
        }
    }
}

function updateDesignTransform() {
    const yPct = parseFloat(document.getElementById('designPositionY')?.value || 0);
    const xPct = parseFloat(document.getElementById('designPositionX')?.value || 50);
    const sizePct = parseFloat(document.getElementById('designSize')?.value || 35);

    state.customization.designPosition = yPct;
    state.customization.designPositionX = xPct;
    state.customization.designSize = sizePct;

    const design = document.getElementById('kurtaDesign');
    if (design) {
        design.style.top = yPct + '%';
        design.style.left = xPct + '%';
        design.style.width = sizePct + '%';
        design.style.transform = 'translateX(-50%)';
    }

    const valY = document.getElementById('valY');
    const valX = document.getElementById('valX');
    const valSize = document.getElementById('valSize');
    
    if (valY) valY.textContent = Math.round(yPct) + '%';
    if (valX) valX.textContent = Math.round(xPct) + '%';
    if (valSize) valSize.textContent = Math.round(sizePct) + '%';

    updateSliderFill(document.getElementById('designPositionY'), yPct, 0, 90);
    updateSliderFill(document.getElementById('designPositionX'), xPct, 10, 90);
    updateSliderFill(document.getElementById('designSize'), sizePct, 10, 100);
}

function updateSliderFill(slider, val, min, max) {
    if (!slider) return;
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(to right, var(--primary) ${pct}%, #e8e8e8 ${pct}%)`;
}

function updatePriceEstimate() {
    const fabricSelect = document.getElementById('fabricSelect');
    const fabric = fabricSelect ? fabricSelect.value : 'cotton';

    const fabricPrices = { cotton: 0, silk: 500, linen: 300, blend: 400 };
    const totalPrice = 3499 + (fabricPrices[fabric] || 0);

    const priceDisplay = document.getElementById('customPrice');
    if (priceDisplay) priceDisplay.textContent = `৳${totalPrice.toLocaleString()}`;
}

function openCustomizer(productId) {
    const customizeSection = document.getElementById('customize');
    if (customizeSection) {
        customizeSection.scrollIntoView({ behavior: 'smooth' });
    }
    showToast('Customize your Punjabi below!', 'success');
}

function addCustomToCart() {
    if (!state.user) {
        showAuthModal();
        showToast('Please login to customize', 'error');
        return;
    }

    const measurements = {
        chest: parseFloat(document.getElementById('chest')?.value) || 40,
        shoulder: parseFloat(document.getElementById('shoulder')?.value) || 18,
        sleeve: parseFloat(document.getElementById('sleeve')?.value) || 24,
        length: parseFloat(document.getElementById('length')?.value) || 28,
        neck: parseFloat(document.getElementById('neck')?.value) || 15,
        waist: parseFloat(document.getElementById('waist')?.value) || 34,
        hip: parseFloat(document.getElementById('hip')?.value) || 38,
        wrist: parseFloat(document.getElementById('wrist')?.value) || 7
    };

    const fabricSelect = document.getElementById('fabricSelect');
    const fabric = fabricSelect ? fabricSelect.value : 'cotton';
    const fabricPrices = { cotton: 0, silk: 500, linen: 300, blend: 400 };
    const totalPrice = 3499 + (fabricPrices[fabric] || 0);

    const customItem = {
        id: 'custom_' + Date.now(),
        name: 'Custom Punjabi',
        price: totalPrice,
        quantity: 1,
        customization: {
            kurtaImage: state.customization.kurtaImage,
            designImage: state.customization.designImage,
            designPositionY: state.customization.designPosition,
            designPositionX: state.customization.designPositionX || 50,
            designSize: state.customization.designSize,
            fabric,
            measurements
        },
        image: state.customization.kurtaImage
    };

    state.cart.push(customItem);
    updateCartUI();
    showToast('Custom Punjabi added to cart!', 'success');
    toggleCart(true);
}

// ============================================
// CART & CHECKOUT
// ============================================
function addToCart(productId) {
    if (!state.user) {
        showAuthModal();
        showToast('Please login to add items', 'error');
        return;
    }

    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock_quantity <= 0) {
        showToast('Sorry, this item is out of stock', 'error');
        return;
    }

    const existingItem = state.cart.find(item => item.id === productId && !item.customization);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: product.price * (1 - (product.discount_percent || 0) / 100),
            quantity: 1,
            image: product.image_url,
            customization: null
        });
    }

    updateCartUI();
    showToast('Added to cart!', 'success');
    toggleCart(true);
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartUI();
}

function updateCartUI() {
    const cartCount = document.querySelector('.cart-count');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) cartCount.textContent = totalItems;

    if (state.cart.length === 0) {
        if (cartItems) cartItems.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
        if (cartTotal) cartTotal.textContent = '৳0';
        return;
    }

    if (cartItems) {
        cartItems.innerHTML = state.cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <p>৳${item.price.toLocaleString()} × ${item.quantity}</p>
                    ${item.customization ? '<small>Custom measurements included</small>' : ''}
                </div>
                <button onclick="removeFromCart(${index})" style="background:none;border:none;cursor:pointer;color:#dc2626;">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `).join('');
    }

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (cartTotal) cartTotal.textContent = `৳${total.toLocaleString()}`;

    lucide.createIcons();
}

function toggleCart(show) {
    const sidebar = document.getElementById('cartSidebar');
    if (!sidebar) return;
    
    if (show === true) sidebar.classList.add('active');
    else if (show === false) sidebar.classList.remove('active');
    else sidebar.classList.toggle('active');
}

async function checkout() {
    if (!state.user) {
        showAuthModal();
        return;
    }

    if (state.cart.length === 0) {
        showToast('Your cart is empty', 'error');
        return;
    }

    const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('address, phone_number, name')
        .eq('id', state.user.id)
        .single();

    const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .insert([{
            user_id: state.user.id,
            total_amount: total,
            shipping_address: profile?.address || 'To be confirmed',
            phone_number: profile?.phone_number || 'To be confirmed',
            status: 'pending'
        }])
        .select()
        .single();

    if (orderError) {
        showToast('Failed to place order. Please try again.', 'error');
        console.error('Order error:', orderError);
        return;
    }

    const orderItems = state.cart.map(item => ({
        order_id: order.id,
        product_id: item.customization ? null : item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        customization_details: item.customization ? JSON.stringify(item.customization) : null
    }));

    const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
        console.error('Order items error:', itemsError);
    }

    state.cart = [];
    updateCartUI();
    toggleCart(false);

    showOrderConfirmationModal(order, total, profile);
    await loadOrders();
}

function showOrderConfirmationModal(order, total, profile) {
    const existing = document.getElementById('orderConfirmModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'orderConfirmModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:480px;text-align:center;padding:40px 32px;">
            <div style="font-size:64px;margin-bottom:16px;">🎉</div>
            <h2 style="font-family:'Playfair Display',serif;margin-bottom:8px;color:#1a1a2e;">Order Placed!</h2>
            <p style="color:#666;margin-bottom:24px;">Thank you, <strong>${profile?.name || 'Valued Customer'}</strong>! Your order has been received.</p>
            <div style="background:#f8f4ff;border-radius:12px;padding:20px;margin-bottom:24px;text-align:left;">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:#666;font-size:14px;">Order ID</span>
                    <span style="font-weight:700;font-size:14px;color:#1a1a2e;">#${order.id.toString().slice(0,8).toUpperCase()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:#666;font-size:14px;">Total Amount</span>
                    <span style="font-weight:700;font-size:16px;color:#7c3aed;">৳${total.toLocaleString()}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <span style="color:#666;font-size:14px;">Status</span>
                    <span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600;">Pending Approval</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:#666;font-size:14px;">Delivery Address</span>
                    <span style="font-size:13px;color:#1a1a2e;max-width:60%;text-align:right;">${profile?.address || 'To be confirmed'}</span>
                </div>
            </div>
            <p style="color:#888;font-size:13px;margin-bottom:24px;">We will contact you on <strong>${profile?.phone_number || 'your number'}</strong> to confirm delivery.</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button class="btn btn-primary" onclick="closeOrderConfirmModal(); document.getElementById('orders').scrollIntoView({behavior:'smooth'});">View My Orders</button>
                <button class="btn btn-secondary" onclick="closeOrderConfirmModal()">Continue Shopping</button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeOrderConfirmModal();
    });

    document.body.appendChild(modal);
}

function closeOrderConfirmModal() {
    const modal = document.getElementById('orderConfirmModal');
    if (modal) modal.remove();
}

// ============================================
// ORDERS
// ============================================
async function loadOrders() {
    if (!state.user) return;

    const { data, error } = await supabaseClient
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading orders:', error);
        return;
    }

    state.orders = data || [];
    renderOrders();
}

function renderOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;

    if (!state.user) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="package"></i>
                <p>Please login to view your orders</p>
                <button class="btn btn-primary" onclick="showAuthModal()">Login Now</button>
            </div>`;
        lucide.createIcons();
        return;
    }

    if (state.orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="shopping-bag"></i>
                <p>You haven't placed any orders yet.</p>
                <a href="#categories" class="btn btn-primary">Start Shopping</a>
            </div>`;
        lucide.createIcons();
        return;
    }

    container.innerHTML = state.orders.map(order => {
        const statusColors = {
            pending:    { bg: '#fef3c7', color: '#d97706' },
            approved:   { bg: '#d1fae5', color: '#059669' },
            processing: { bg: '#dbeafe', color: '#2563eb' },
            shipped:    { bg: '#ede9fe', color: '#7c3aed' },
            delivered:  { bg: '#d1fae5', color: '#059669' },
            rejected:   { bg: '#fee2e2', color: '#dc2626' },
            cancelled:  { bg: '#f3f4f6', color: '#6b7280' }
        };
        const statusStyle = statusColors[order.status] || { bg: '#f3f4f6', color: '#6b7280' };

        const date = new Date(order.created_at).toLocaleDateString('en-BD', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        const itemCount = order.order_items ? order.order_items.length : 0;

        return `
            <div class="order-card" style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
                    <div>
                        <p style="font-size:13px;color:#888;margin-bottom:4px;">Order ID</p>
                        <p style="font-weight:700;color:#1a1a2e;">#${order.id.toString().slice(0,8).toUpperCase()}</p>
                    </div>
                    <span style="background:${statusStyle.bg};color:${statusStyle.color};padding:4px 14px;border-radius:20px;font-size:13px;font-weight:600;text-transform:capitalize;">
                        ${order.status}
                    </span>
                </div>
                <div style="display:flex;gap:24px;margin-top:14px;flex-wrap:wrap;">
                    <div>
                        <p style="font-size:12px;color:#888;">Date</p>
                        <p style="font-size:14px;font-weight:500;">${date}</p>
                    </div>
                    <div>
                        <p style="font-size:12px;color:#888;">Items</p>
                        <p style="font-size:14px;font-weight:500;">${itemCount} item${itemCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div>
                        <p style="font-size:12px;color:#888;">Total</p>
                        <p style="font-size:16px;font-weight:700;color:#7c3aed;">৳${order.total_amount.toLocaleString()}</p>
                    </div>
                </div>
                ${order.shipping_address && order.shipping_address !== 'To be confirmed' ? `
                    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6;">
                        <p style="font-size:12px;color:#888;">Delivery To</p>
                        <p style="font-size:13px;color:#444;">${order.shipping_address}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ============================================
// AUTH MODAL
// ============================================
function showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('active');
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.add('hidden'));

    if (tab === 'login') {
        const loginTab = document.querySelector('.auth-tab:first-child');
        const loginForm = document.getElementById('loginForm');
        if (loginTab) loginTab.classList.add('active');
        if (loginForm) loginForm.classList.remove('hidden');
    } else {
        const registerTab = document.querySelector('.auth-tab:last-child');
        const registerForm = document.getElementById('registerForm');
        if (registerTab) registerTab.classList.add('active');
        if (registerForm) registerForm.classList.remove('hidden');
    }
}

// ============================================
// ADMIN MODAL (FIXED - HARDCODED ADMIN)
// ============================================
function showAdminModal() {
    // Double-check admin status
    if (!state.isAdmin) {
        showToast('Admin access denied', 'error');
        return;
    }
    
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.add('active');
    
    const adminName = document.getElementById('adminName');
    if (adminName) adminName.textContent = state.user?.email || 'Admin';
    
    loadAdminData();
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('active');
}

async function loadAdminData() {
    await Promise.all([
        loadAdminStats(),
        loadAdminOrders(),
        loadAdminProducts(),
        loadAdminCustomers()
    ]);
}

async function loadAdminStats() {
    try {
        const [ordersRes, productsRes] = await Promise.all([
            supabaseClient.from('orders').select('id, status'),
            supabaseClient.from('products').select('id, stock_quantity')
        ]);

        const orders = ordersRes.data || [];
        const products = productsRes.data || [];

        const totalOrdersEl = document.getElementById('totalOrders');
        const pendingOrdersEl = document.getElementById('pendingOrders');
        const totalProductsEl = document.getElementById('totalProducts');
        const lowStockEl = document.getElementById('lowStock');

        if (totalOrdersEl) totalOrdersEl.textContent = orders.length;
        if (pendingOrdersEl) pendingOrdersEl.textContent = orders.filter(o => o.status === 'pending').length;
        if (totalProductsEl) totalProductsEl.textContent = products.length;
        if (lowStockEl) lowStockEl.textContent = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
    } catch (err) {
        console.error('Error loading admin stats:', err);
    }
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));

    const tabs = document.querySelectorAll('.admin-tab');
    const targetPanel = document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    
    tabs.forEach(t => {
        if (t.getAttribute('onclick')?.includes(tab)) {
            t.classList.add('active');
        }
    });
    
    if (targetPanel) targetPanel.classList.remove('hidden');
}

// --- Admin: Orders ---
async function loadAdminOrders() {
    try {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*, profiles(name, email, phone_number)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('adminOrdersList');
        if (!data || data.length === 0) {
            if (container) container.innerHTML = '<p style="color:#888;padding:16px;">No orders yet.</p>';
            return;
        }

        if (container) {
            container.innerHTML = data.map(order => {
                const date = new Date(order.created_at).toLocaleDateString('en-BD', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });

                return `
                    <div class="admin-order-card" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                            <div>
                                <span style="font-weight:700;color:#1a1a2e;">#${order.id.toString().slice(0,8).toUpperCase()}</span>
                                <span style="color:#888;font-size:13px;margin-left:8px;">${date}</span>
                            </div>
                            <span style="font-weight:700;color:#7c3aed;font-size:16px;">৳${order.total_amount.toLocaleString()}</span>
                        </div>
                        <div style="font-size:13px;color:#555;margin-bottom:12px;">
                            <strong>Customer:</strong> ${order.profiles?.name || 'N/A'} — ${order.profiles?.email || ''}<br>
                            <strong>Phone:</strong> ${order.phone_number || order.profiles?.phone_number || 'N/A'}<br>
                            <strong>Address:</strong> ${order.shipping_address || 'N/A'}
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                            <label style="font-size:13px;font-weight:500;">Status:</label>
                            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding:6px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;cursor:pointer;">
                                ${['pending','approved','processing','shipped','delivered','rejected','cancelled'].map(s =>
                                    `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                                ).join('')}
                            </select>
                            <button onclick="approveOrder('${order.id}')" style="background:#d1fae5;color:#059669;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">✓ Approve</button>
                            <button onclick="rejectOrder('${order.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">✕ Reject</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading admin orders:', err);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) throw error;
        
        showToast(`Order status updated to "${newStatus}"`, 'success');
        await loadAdminStats();
    } catch (err) {
        showToast('Failed to update status', 'error');
        console.error(err);
    }
}

async function approveOrder(orderId) {
    await updateOrderStatus(orderId, 'approved');
    await loadAdminOrders();
}

async function rejectOrder(orderId) {
    await updateOrderStatus(orderId, 'rejected');
    await loadAdminOrders();
}

// --- Admin: Products ---
async function loadAdminProducts() {
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*, categories(name)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('adminProductsList');
        if (!data || data.length === 0) {
            if (container) container.innerHTML = '<p style="color:#888;padding:16px;">No products yet.</p>';
            return;
        }

        if (container) {
            container.innerHTML = data.map(product => {
                const stockColor = product.stock_quantity > 10 ? '#059669' :
                    product.stock_quantity > 0 ? '#d97706' : '#dc2626';
                const stockLabel = product.stock_quantity > 10 ? 'In Stock' :
                    product.stock_quantity > 0 ? `Low (${product.stock_quantity})` : 'Out of Stock';

                return `
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
                        <img src="${product.image_url}" alt="${product.name}" style="width:60px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0;">
                        <div style="flex:1;min-width:160px;">
                            <p style="font-weight:700;color:#1a1a2e;margin-bottom:4px;">${product.name}</p>
                            <p style="font-size:13px;color:#888;margin-bottom:4px;">${product.categories?.name || 'Uncategorized'}</p>
                            <p style="font-size:15px;font-weight:700;color:#7c3aed;">৳${product.price.toLocaleString()}</p>
                        </div>
                        <div style="text-align:center;">
                            <span style="background:${stockColor}22;color:${stockColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">${stockLabel}</span>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="showEditProductModal('${product.id}')" style="background:#ede9fe;color:#7c3aed;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Edit</button>
                            <button onclick="deleteProduct('${product.id}')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Error loading admin products:', err);
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const { error } = await supabaseClient.from('products').delete().eq('id', productId);
        if (error) throw error;
        
        showToast('Product deleted', 'success');
        await loadAdminProducts();
        await loadAdminStats();
    } catch (err) {
        showToast('Failed to delete product', 'error');
        console.error(err);
    }
}

function showAddProductModal() {
    showProductFormModal(null);
}

async function showEditProductModal(productId) {
    try {
        const { data: product, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            showToast('Could not load product', 'error');
            return;
        }
        showProductFormModal(product);
    } catch (err) {
        showToast('Error loading product', 'error');
    }
}

function showProductFormModal(product) {
    const isEdit = !!product;
    const existing = document.getElementById('productFormModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'productFormModal';
    modal.className = 'modal active';
    modal.style.zIndex = '10000';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;padding:32px;">
            <button class="modal-close" onclick="document.getElementById('productFormModal').remove()">
                <i data-lucide="x"></i>
            </button>
            <h3 style="font-family:'Playfair Display',serif;margin-bottom:20px;">${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <input id="pf_name" class="auth-input" placeholder="Product Name" value="${product?.name || ''}">
                <textarea id="pf_desc" class="auth-input" placeholder="Description" rows="2">${product?.description || ''}</textarea>
                <input id="pf_price" class="auth-input" placeholder="Price (৳)" type="number" value="${product?.price || ''}">
                <input id="pf_image" class="auth-input" placeholder="Image URL" value="${product?.image_url || ''}">
                <input id="pf_stock" class="auth-input" placeholder="Stock Quantity" type="number" value="${product?.stock_quantity ?? ''}">
                <input id="pf_discount" class="auth-input" placeholder="Discount % (0 for none)" type="number" value="${product?.discount_percent || 0}">
                <div style="display:flex;align-items:center;gap:10px;">
                    <label style="font-size:14px;font-weight:500;">Featured</label>
                    <input type="checkbox" id="pf_featured" ${product?.is_featured ? 'checked' : ''}>
                    <label style="font-size:14px;font-weight:500;margin-left:12px;">Customizable</label>
                    <input type="checkbox" id="pf_custom" ${product?.is_customizable ? 'checked' : ''}>
                </div>
                <button class="btn btn-primary" onclick="${isEdit ? `saveEditProduct('${product.id}')` : 'saveNewProduct()'}">
                    ${isEdit ? 'Save Changes' : 'Add Product'}
                </button>
            </div>
        </div>
    `;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    lucide.createIcons();
}

async function saveNewProduct() {
    const payload = getProductFormData();
    if (!payload) return;

    try {
        const { error } = await supabaseClient.from('products').insert([payload]);
        if (error) throw error;
        
        showToast('Product added!', 'success');
        document.getElementById('productFormModal')?.remove();
        await loadAdminProducts();
        await loadAdminStats();
        await loadFeaturedProducts();
    } catch (err) {
        showToast('Failed to add product: ' + err.message, 'error');
    }
}

async function saveEditProduct(productId) {
    const payload = getProductFormData();
    if (!payload) return;

    try {
        const { error } = await supabaseClient.from('products').update(payload).eq('id', productId);
        if (error) throw error;
        
        showToast('Product updated!', 'success');
        document.getElementById('productFormModal')?.remove();
        await loadAdminProducts();
        await loadFeaturedProducts();
    } catch (err) {
        showToast('Failed to update product: ' + err.message, 'error');
    }
}

function getProductFormData() {
    const name = document.getElementById('pf_name')?.value.trim();
    const description = document.getElementById('pf_desc')?.value.trim();
    const price = parseFloat(document.getElementById('pf_price')?.value);
    const image_url = document.getElementById('pf_image')?.value.trim();
    const stock_quantity = parseInt(document.getElementById('pf_stock')?.value);
    const discount_percent = parseFloat(document.getElementById('pf_discount')?.value) || 0;
    const is_featured = document.getElementById('pf_featured')?.checked || false;
    const is_customizable = document.getElementById('pf_custom')?.checked || false;

    if (!name || isNaN(price) || !image_url || isNaN(stock_quantity)) {
        showToast('Please fill all required fields', 'error');
        return null;
    }

    return { name, description, price, image_url, stock_quantity, discount_percent, is_featured, is_customizable };
}

// --- Admin: Customers ---
async function loadAdminCustomers() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('adminCustomersList');
        if (!data || data.length === 0) {
            if (container) container.innerHTML = '<p style="color:#888;padding:16px;">No customers yet.</p>';
            return;
        }

        if (container) {
            container.innerHTML = `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:14px;">
                        <thead>
                            <tr style="background:#f3f4f6;">
                                <th style="padding:10px 14px;text-align:left;color:#555;">Name</th>
                                <th style="padding:10px 14px;text-align:left;color:#555;">Email</th>
                                <th style="padding:10px 14px;text-align:left;color:#555;">Phone</th>
                                <th style="padding:10px 14px;text-align:left;color:#555;">Address</th>
                                <th style="padding:10px 14px;text-align:left;color:#555;">Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(customer => `
                                <tr style="border-bottom:1px solid #f3f4f6;">
                                    <td style="padding:10px 14px;font-weight:500;">${customer.name || '—'}</td>
                                    <td style="padding:10px 14px;color:#555;">${customer.email || '—'}</td>
                                    <td style="padding:10px 14px;color:#555;">${customer.phone_number || '—'}</td>
                                    <td style="padding:10px 14px;color:#555;max-width:180px;">${customer.address || '—'}</td>
                                    <td style="padding:10px 14px;">
                                        <span style="background:${customer.is_admin ? '#ede9fe' : '#f3f4f6'};color:${customer.is_admin ? '#7c3aed' : '#6b7280'};padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">
                                            ${customer.is_admin ? 'Admin' : 'Customer'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        console.error('Error loading customers:', err);
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease, fadeOut 0.4s ease 2.6s forwards;
        max-width: 320px;
        word-wrap: break-word;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Add toast animation styles once
(function injectToastStyles() {
    if (document.getElementById('toastStyles')) return;
    const style = document.createElement('style');
    style.id = 'toastStyles';
    style.textContent = `
        .toast-container {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to   { opacity: 0; transform: translateY(-6px); }
        }
    `;
    document.head.appendChild(style);
})();