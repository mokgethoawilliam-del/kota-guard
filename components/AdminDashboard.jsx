import React, { useState, useEffect } from 'react';
import { supabase } from '../src/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Audio context for the "Ding" sound alert
const playDing = () => {
    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio autoplay blocked by browser:', e));
    } catch (err) {
        console.error("Failed to play sound", err);
    }
};

export default function AdminDashboard({ session }) {
    const [orders, setOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [activeTab, setActiveTab] = useState('kds'); 
    
    // Multi-tenant state: Derived from Auth session
    const [currentVendorId, setCurrentVendorId] = useState(null);
    const [vendorConfig, setVendorConfig] = useState(null);
    const [profile, setProfile] = useState(null);

    // CMS State
    const [newStallEvent, setNewStallEvent] = useState({
        name: '',
        banner_text: '',
        stall_date: '',
        preorder_start_date: '',
        preorder_deadline: ''
    });
    const [isSavingStall, setIsSavingStall] = useState(false);
    const [editingMenuItem, setEditingMenuItem] = useState({ id: null, name: '', price: '', image_url: '' });

    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
    const [vaultPassword, setVaultPassword] = useState('');
    const [vaultError, setVaultError] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [vaultTimer, setVaultTimer] = useState(20); // 20-second auto-lock timer
    
    // Delete Account State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmationWord, setDeleteConfirmationWord] = useState('');
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    
    // Phase 11: CMS Sub-navigation
    const [cmsActiveSubTab, setCmsActiveSubTab] = useState('menu'); // 'menu' | 'branches' | 'events' | 'branding'
    const [isSavingBranch, setIsSavingBranch] = useState(false);
    const [newBranch, setNewBranch] = useState({ name: '', address: '', google_maps_url: '', is_active: true });
    const [heroImageFile, setHeroImageFile] = useState(null);
    const [uploadingHero, setUploadingHero] = useState(false);
    
    // Menu Image Upload State
    const [menuImageFile, setMenuImageFile] = useState(null);
    const [uploadingMenuImage, setUploadingMenuImage] = useState(false);

    // Custom Live Chat & KDS Clock State
    const [liveTime, setLiveTime] = useState(new Date().toLocaleTimeString());
    const [chats, setChats] = useState([]);
    const [activeChatSession, setActiveChatSession] = useState(null);
    const [newAdminMessage, setNewAdminMessage] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');
    
    // Arrival Alert Toast Trigger
    const [arrivalAlert, setArrivalAlert] = useState(null);
    
    // Phase 12: Logistics & Security PIN
    const [chatMode, setChatMode] = useState('active'); // 'active' | 'history'
    const [isVerifyingPin, setIsVerifyingPin] = useState(null); // stores order object when verifying
    const [verificationPin, setVerificationPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isSavingLogistics, setIsSavingLogistics] = useState(false);

    // Phase 13: Vault Categorization
    const [vaultActiveSection, setVaultActiveSection] = useState(null); // null | 'paystack' | 'netcash' | 'domains' | 'whatsapp'
    const [isSavingVault, setIsSavingVault] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setLiveTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadProfileAndData = async () => {
            if (!session?.user?.id) return;

            // 1. Fetch Profile to get vendor_id
            const { data: profileData, error: pErr } = await supabase
                .from('profiles')
                .select('vendor_id, full_name')
                .eq('id', session.user.id)
                .single();

            if (pErr || !profileData) {
                console.warn("Profile table entry not found, using session metadata fallback...");
                const metadata = session.user.user_metadata;
                if (metadata?.vendor_id) {
                    const fallbackProfile = {
                        vendor_id: metadata.vendor_id,
                        full_name: metadata.full_name || 'Shop Owner'
                    };
                    setProfile(fallbackProfile);
                    setCurrentVendorId(metadata.vendor_id);
                    return;
                }
                console.error("Critical: No vendor_id found in profile OR metadata.", pErr);
                return;
            }

            setProfile(profileData);
            setCurrentVendorId(profileData.vendor_id);
            setLoading(false); // Make sure dashboard can proceed
        };

        loadProfileAndData().finally(() => setLoading(false));
    }, [session]);

    useEffect(() => {
        if (!currentVendorId) return;
        fetchInitialData();

        // 1. Subscribe to Realtime Updates on the 'orders' table
        const channel = supabase
            .channel('public:orders')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    const updatedOrder = payload.new;

                    setOrders(currentOrders => {
                        const existingOrder = currentOrders.find(o => o.id === updatedOrder.id);
                        
                        let shouldDing = false;
                        if (updatedOrder.status === 'paid' && (!existingOrder || existingOrder.status !== 'paid')) {
                            shouldDing = true;
                        }
                        // Customer notified they arrived
                        if (updatedOrder.customer_arrived && existingOrder && !existingOrder.customer_arrived) {
                            shouldDing = true;
                            // Trigger visible toast notification
                            setArrivalAlert(updatedOrder);
                            setTimeout(() => setArrivalAlert(null), 10000); // Hide after 10s
                        }

                        if (shouldDing) playDing();

                        if (existingOrder) {
                            if (updatedOrder.status === 'completed' || updatedOrder.status === 'refunded') {
                                // Move it out of active queue and into history
                                setHistoryOrders(curr => {
                                    if (!curr.find(o => o.id === updatedOrder.id)) {
                                        return [{ ...existingOrder, ...updatedOrder }, ...curr];
                                    }
                                    return curr;
                                });
                                return currentOrders.filter(o => o.id !== updatedOrder.id);
                            }
                            // Merge payload to preserve nested order_items
                            return currentOrders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
                        } else {
                            // Only add to dashboard if not completed
                            if (updatedOrder.status !== 'completed' && updatedOrder.status !== 'refunded') {
                                return [updatedOrder, ...currentOrders];
                            } else {
                                // If we don't have it, but it updated to completed, we should ideally fetch it.
                                // For now it will populate on next refresh.
                            }
                            return currentOrders;
                        }
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    const newOrder = payload.new;
                    if (newOrder.status === 'paid') playDing();
                    if (newOrder.status !== 'completed' && newOrder.status !== 'refunded') {
                        setOrders(current => [newOrder, ...current]);
                    }
                }
            )
            .subscribe();

        // 2. Subscribe to Support Chats
        const chatChannel = supabase
            .channel('public:support_chats')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'support_chats' },
                (payload) => {
                    const newChat = payload.new;
                    if (newChat.vendor_id === currentVendorId) {
                        setChats(current => [...current, newChat]);
                        if (newChat.sender_type === 'customer') playDing();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(chatChannel);
        };
    }, [currentVendorId]);

    // Auto-Lock Inactivity Timer for the Vault
    useEffect(() => {
        let countdown;
        let activityListener;

        if (isVaultUnlocked) {
            // Reset timer to 20 when vault is first opened
            setVaultTimer(20);

            // Interval to count down
            countdown = setInterval(() => {
                setVaultTimer(prev => {
                    if (prev <= 1) {
                        setIsVaultUnlocked(false);
                        setVaultPassword('');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Reset timer on any activity
            activityListener = () => {
                setVaultTimer(20);
            };
            
            window.addEventListener('mousemove', activityListener);
            window.addEventListener('keydown', activityListener);
            window.addEventListener('click', activityListener);
            window.addEventListener('touchstart', activityListener);
        }

        return () => {
            clearInterval(countdown);
            window.removeEventListener('mousemove', activityListener);
            window.removeEventListener('keydown', activityListener);
            window.removeEventListener('click', activityListener);
            window.removeEventListener('touchstart', activityListener);
        };
    }, [isVaultUnlocked]);

    async function fetchInitialData() {
        if (!currentVendorId) return;
        try {
            // No need to set loading(true) here as it's already true from the start
            // and we want a smooth transition after profile load.

            // Fetch Vendor Profile
            const { data: vData } = await supabase.from('vendors').select('*').eq('id', currentVendorId).single();
            if (vData) setVendorConfig(vData);

            // Get valid locations for this vendor
            const { data: locData } = await supabase.from('locations').select('*').eq('vendor_id', currentVendorId);
            if (locData) setLocations(locData);

            // Get all non-pending orders for this vendor
            const { data: orderData, error: orderErr } = await supabase
                .from('orders')
                .select(`
                    *,
                    locations (name),
                    order_items (
                        quantity,
                        modifiers_json,
                        menu_items (name)
                    )
                `)
                .eq('vendor_id', currentVendorId)
                .neq('status', 'pending') 
                .order('created_at', { ascending: false });

            if (orderErr) throw orderErr;

            const active = orderData?.filter(o => o.status !== 'completed' && o.status !== 'refunded') || [];
            const history = orderData?.filter(o => o.status === 'completed' || o.status === 'refunded') || [];

            setOrders(active);
            setHistoryOrders(history);

            // Fetch Expenses for this vendor
            const { data: expData, error: expErr } = await supabase
                .from('expenses')
                .select('*')
                .eq('vendor_id', currentVendorId)
                .order('created_at', { ascending: false });

            if (!expErr && expData) {
                setExpenses(expData);
            }

            // Fetch Ingredients for this vendor
            const { data: ingData, error: ingErr } = await supabase
                .from('ingredients')
                .select('*')
                .eq('vendor_id', currentVendorId)
                .order('name');

            if (!ingErr && ingData) {
                setIngredients(ingData);
            }

            // Fetch Menu Items (For CMS) for this vendor
            const { data: menuData, error: menuErr } = await supabase
                .from('menu_items')
                .select('*')
                .eq('vendor_id', currentVendorId)
                .order('price');

            if (!menuErr && menuData) {
                setMenuItems(menuData);
            }

            // Fetch Support Chats
            const { data: chatData } = await supabase
                .from('support_chats')
                .select('*')
                .eq('vendor_id', currentVendorId)
                .order('created_at', { ascending: true });
            
            if (chatData) {
                setChats(chatData);
            }

        } catch (err) {
            console.error('Error fetching dashboard data:', err.message);
        } finally {
            setLoading(false);
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        try {
            // Deduct inventory if moving away from 'paid' to a preparation state
            if ((newStatus === 'preparing' || newStatus === 'ready') && order.status === 'paid') {
                console.log(`Inventory: Deducting for order ${orderId} moving to ${newStatus}`);
                if (order && order.order_items) {
                    const inventoryDeductions = {};

                    // Sum up all ingredients needed for this entire order
                    order.order_items.forEach(item => {
                        const recipe = item.menu_items?.recipe_json || {};
                        const qty = Number(item.quantity || 1);

                        Object.keys(recipe).forEach(ingredientName => {
                            const amountPerItem = Number(recipe[ingredientName]);
                            inventoryDeductions[ingredientName] = (inventoryDeductions[ingredientName] || 0) + (amountPerItem * qty);
                        });
                    });

                    // Deduct each ingredient from the database
                    for (const ingredientName of Object.keys(inventoryDeductions)) {
                        const amountToDeduct = inventoryDeductions[ingredientName];

                        // Fetch current stock directly from DB to prevent race conditions
                        const { data: invData, error: fetchErr } = await supabase
                            .from('ingredients')
                            .select('id, current_stock')
                            .eq('name', ingredientName)
                            .eq('vendor_id', currentVendorId)
                            .maybeSingle();

                        if (!fetchErr && invData && invData.current_stock !== null) {
                            const newStock = Math.max(0, Number(invData.current_stock) - amountToDeduct);
                            await supabase
                                .from('ingredients')
                                .update({ current_stock: newStock })
                                .eq('id', invData.id);
                        }
                    }

                    // Refresh inventory state silently to reflect deductions
                    supabase.from('ingredients').select('*').order('name').then(({ data }) => {
                        if (data) setIngredients(data);
                    });
                }
            }

            // Optimistic UI update
            if (newStatus === 'completed' || newStatus === 'refunded') {
                const orderToMove = orders.find(o => o.id === orderId);
                if (orderToMove) {
                    const finishedOrder = { ...orderToMove, status: newStatus };
                    setOrders(current => current.filter(o => o.id !== orderId));
                    setHistoryOrders(curr => [finishedOrder, ...curr]);
                }
            } else {
                setOrders(current => current.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId);

            if (error) {
                // Revert on failure
                fetchInitialData();
                throw error;
            }
        } catch (err) {
            console.error("Failed to update status", err);
            alert("Could not update order status.");
        }
    };

    // Phase 4: Business Intelligence - Basic CSV Export (Active Queue)
    const exportToCSV = () => {
        if (orders.length === 0) {
            alert("No data to export right now.");
            return;
        }

        const headers = ['Order Number', 'Date', 'Status', 'Customer', 'WhatsApp', 'Total (ZAR)'];
        const rows = orders.map(o => [
            o.order_number,
            new Date(o.created_at).toLocaleString(),
            o.status,
            o.customer_name,
            o.customer_phone,
            o.total_price
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `kotaguard_active_queue_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // History Filter Logic
    const displayedHistoryOrders = historyFilter === 'today'
        ? historyOrders.filter(o => {
            const d = new Date(o.created_at);
            const today = new Date();
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        })
        : historyOrders;

    // Phase 7: History Vault PDF Export
    const exportPDF = () => {
        if (displayedHistoryOrders.length === 0) return alert("No history to export.");

        const doc = new jsPDF();
        doc.text(`${vendorConfig.name} - CRM & Sales Report (${historyFilter.toUpperCase()})`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

        const tableColumn = ["Order #", "Date", "Customer", "WhatsApp Num", "Items", "Total"];
        const tableRows = [];

        displayedHistoryOrders.forEach(order => {
            const itemsStr = order.order_items?.map(i => `${i.quantity}x ${i.menu_items?.name}`).join(', ') || '';
            const rowData = [
                order.order_number,
                new Date(order.created_at).toLocaleDateString(),
                order.customer_name,
                order.customer_phone,
                itemsStr,
                `R ${order.total_price}`
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
        });

        const totalRev = displayedHistoryOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);
        // lastAutoTable might be attached directly to doc
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 30 + (tableRows.length * 10);
        doc.text(`Total Revenue in report: R ${totalRev}`, 14, finalY + 10);

        doc.save(`${vendorConfig.slug}_sales_report_${new Date().getTime()}.pdf`);
    };

    // Phase 8: Add Expense with Receipt Upload
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', receiptFile: null });
    const [uploadingReceipt, setUploadingReceipt] = useState(false);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            setUploadingReceipt(true);
            let receipt_url = null;

            // 1. Upload receipt to Supabase Storage if file exists
            if (newExpense.receiptFile) {
                const fileExt = newExpense.receiptFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `receipts/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('business-documents')
                    .upload(filePath, newExpense.receiptFile);

                if (uploadError) {
                    console.error("Upload error (Bucket 'business-documents' might be missing):", uploadError);
                    alert("Could not upload receipt image. Ensure the Storage bucket 'business-documents' exists and is public.");
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('business-documents')
                        .getPublicUrl(filePath);
                    receipt_url = publicUrl;
                }
            }

            // 2. Insert expense record
            const { data, error } = await supabase
                .from('expenses')
                .insert({
                    vendor_id: currentVendorId,
                    description: newExpense.description,
                    amount: parseFloat(newExpense.amount),
                    receipt_url: receipt_url
                })
                .select()
                .single();

            if (error) throw error;

            setExpenses([data, ...expenses]);
            setNewExpense({ description: '', amount: '', receiptFile: null });

            // Clear file input manually
            const fileInput = document.getElementById('receipt-upload');
            if (fileInput) fileInput.value = '';

        } catch (err) {
            console.error(err);
            alert("Could not add expense. Make sure the expenses table exists in Supabase.");
        } finally {
            setUploadingReceipt(false);
        }
    };

    // Phase 9: Add / Delete Ingredients
    const [editingIngredient, setEditingIngredient] = useState({ id: null, name: '', unit: '', current_stock: '', low_stock_threshold: '' });
    const [isAddingIngredient, setIsAddingIngredient] = useState(false);

    const handleSaveIngredient = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: editingIngredient.name,
                unit: editingIngredient.unit,
                current_stock: parseFloat(editingIngredient.current_stock || 0),
                low_stock_threshold: parseFloat(editingIngredient.low_stock_threshold || 10)
            };

            let query = supabase.from('ingredients');
            if (editingIngredient.id) {
                query = query.update(payload).eq('id', editingIngredient.id);
            } else {
                query = query.insert([{ ...payload, vendor_id: currentVendorId }]);
            }

            const { data, error } = await query.select();
            if (error) throw error;

            if (editingIngredient.id) {
                setIngredients(ingredients.map(ing => ing.id === editingIngredient.id ? data[0] : ing).sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setIngredients([...ingredients, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
            }

            setEditingIngredient({ id: null, name: '', unit: '', current_stock: '', low_stock_threshold: '' });
            setIsAddingIngredient(false);
        } catch (err) {
            console.error(err);
            alert(`Could not ${editingIngredient.id ? "update" : "add"} ingredient: ` + err.message);
        }
    };

    const handleDeleteIngredient = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? This might break recipe deductions.`)) return;

        try {
            const { error } = await supabase.from('ingredients').delete().eq('id', id);
            if (error) throw error;
            setIngredients(ingredients.filter(ing => ing.id !== id));
        } catch (err) {
            console.error(err);
            alert("Could not delete ingredient.");
        }
    };

    // Phase 11 & 12: Stall Events Manager
    const handleAddStallEvent = async (e) => {
        e.preventDefault();
        setIsSavingStall(true);
        try {
            const { data, error } = await supabase
                .from('locations')
                .insert([{
                    vendor_id: currentVendorId,
                    name: newStallEvent.name || `Mobile Stall - ${newStallEvent.stall_date || Date.now()}`,
                    banner_text: newStallEvent.banner_text,
                    address: newStallEvent.address,
                    google_maps_url: newStallEvent.google_maps_url,
                    stall_date: newStallEvent.stall_date,
                    preorder_start_date: newStallEvent.preorder_start_date,
                    preorder_deadline: newStallEvent.preorder_deadline,
                    is_mobile: true,
                    is_active: true
                }])
                .select();

            if (error) throw error;
            if (data && data.length > 0) {
                setLocations([...locations, data[0]]);
            }
            alert("New mobile stall event added successfully!");
            setNewStallEvent({ name: '', banner_text: '', address: '', google_maps_url: '', stall_date: '', preorder_start_date: '', preorder_deadline: '' });
        } catch (err) {
            console.error(err);
            alert("Could not add stall event. Name might be duplicate.");
        } finally {
            setIsSavingStall(false);
        }
    };

    const handleDeleteStallEvent = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete the event '${name}'?`)) return;
        try {
            const { error } = await supabase.from('locations').delete().eq('id', id);
            if (error) throw error;
            setLocations(locations.filter(l => l.id !== id));
        } catch (err) {
            console.error(err);
            alert("Could not delete the stall event.");
        }
    };

    const [editingRecipeFor, setEditingRecipeFor] = useState(null);
    const [editingRecipeIngredients, setEditingRecipeIngredients] = useState([]);

    const handleSaveRecipe = async () => {
        try {
            const recipeJson = {};
            editingRecipeIngredients.forEach(item => {
                if (item.ingredient && item.quantity > 0) {
                    recipeJson[item.ingredient] = parseFloat(item.quantity);
                }
            });

            const { error } = await supabase.from('menu_items')
                .update({ recipe_json: recipeJson })
                .eq('id', editingRecipeFor.id);

            if (error) throw error;

            setMenuItems(menuItems.map(m => m.id === editingRecipeFor.id ? { ...m, recipe_json: recipeJson } : m));
            alert("Recipe saved successfully! Inventory will deduct when this item is marked as Preparing.");
            setEditingRecipeFor(null);
        } catch (err) {
            console.error(err);
            alert("Failed to save recipe: " + err.message);
        }
    };

    const handleAddRecipeIngredientRow = () => setEditingRecipeIngredients([...editingRecipeIngredients, { ingredient: '', quantity: '' }]);
    const handleRemoveRecipeIngredientRow = (index) => setEditingRecipeIngredients(editingRecipeIngredients.filter((_, i) => i !== index));
    const handleRecipeIngredientChange = (index, field, value) => {
        const newArr = [...editingRecipeIngredients];
        newArr[index][field] = value;
        setEditingRecipeIngredients(newArr);
    };

    const openRecipeBuilder = (menuItem) => {
        setEditingRecipeFor(menuItem);
        const existingRecipe = menuItem.recipe_json || {};
        const rows = Object.keys(existingRecipe).map(key => ({ ingredient: key, quantity: existingRecipe[key] }));
        setEditingRecipeIngredients(rows.length > 0 ? rows : [{ ingredient: '', quantity: '' }]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveMenuItem = async (e) => {
        e.preventDefault();
        try {
            setUploadingMenuImage(true);
            let finalImageUrl = editingMenuItem.image_url || null;

            if (menuImageFile) {
                const fileExt = menuImageFile.name.split('.').pop();
                const fileName = `menu_${Date.now()}.${fileExt}`;
                const filePath = `menu-images/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('business-documents')
                    .upload(filePath, menuImageFile);

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    alert("Could not upload menu image.");
                    setUploadingMenuImage(false);
                    return;
                }
                
                const { data: { publicUrl } } = supabase.storage
                    .from('business-documents')
                    .getPublicUrl(filePath);
                
                finalImageUrl = publicUrl;
            }

            if (editingMenuItem.id) {
                // Update existing item
                const { error } = await supabase.from('menu_items')
                    .update({
                        name: editingMenuItem.name,
                        price: parseFloat(editingMenuItem.price),
                        image_url: finalImageUrl
                    })
                    .eq('id', editingMenuItem.id);

                if (error) throw error;

                setMenuItems(menuItems.map(item => item.id === editingMenuItem.id ? { ...editingMenuItem, image_url: finalImageUrl, price: parseFloat(editingMenuItem.price) } : item).sort((a, b) => a.price - b.price));
                alert("Menu item updated successfully!");
            } else {
                // Insert new item
                const { data, error } = await supabase.from('menu_items')
                    .insert([{
                        vendor_id: currentVendorId,
                        name: editingMenuItem.name,
                        price: parseFloat(editingMenuItem.price),
                        image_url: finalImageUrl
                    }])
                    .select().single();

                if (error) throw error;
                setMenuItems([...menuItems, data].sort((a, b) => a.price - b.price));
                alert("New menu item added successfully!");
            }

            setEditingMenuItem({ id: null, name: '', price: '', image_url: '' });
            setMenuImageFile(null);
        } catch (err) {
            console.error(err);
            alert(`Could not save menu item: ${err.message || 'Unknown error. Name might be a duplicate.'}`);
        } finally {
            setUploadingMenuImage(false);
        }
    };

    const handleDeleteMenuItem = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete ${name}? Customers will no longer be able to order it.`)) return;
        try {
            const { error } = await supabase.from('menu_items').delete().eq('id', id);
            if (error) throw error;
            setMenuItems(menuItems.filter(item => item.id !== id));
        } catch (err) {
            console.error(err);
            alert("Could not delete menu item.");
        }
    };

    // Financial Calculations
    // Include all paid, preparing, ready, and completed orders as revenue
    const totalRevenue = [...orders, ...historyOrders].reduce((sum, o) => {
        if (o.status !== 'refunded' && o.status !== 'pending') {
            return sum + Number(o.total_price || 0);
        }
        return sum;
    }, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    const filteredOrders = selectedLocation === 'all'
        ? orders
        : orders.filter(o => o.location_id === selectedLocation);

    // Grouping for the Kanban/KFC display
    const newOrders = filteredOrders.filter(o => o.status === 'paid');
    const prepOrders = filteredOrders.filter(o => o.status === 'preparing');
    const readyOrders = filteredOrders.filter(o => o.status === 'ready');



    if (loading || !vendorConfig) return (
        <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner"></div>
            <div>
                <h2 style={{ marginBottom: '0.5rem' }}>Configuring your kitchen...</h2>
                <p style={{ color: '#94a3b8', maxWidth: '400px', fontSize: '0.9rem' }}>
                    If this takes more than 10 seconds, please ensure you have run the <b>master-setup.sql</b> script in your Supabase dashboard.
                </p>
            </div>
            
            <button 
                onClick={() => window.location.reload()}
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1.5rem', borderRadius: '12px', cursor: 'pointer' }}
            >
                🔄 Refresh Page
            </button>
        </div>
    );

    return (
        <div className="kds-container">
            {/* ARRIVAL ALERT TOAST */}
            {arrivalAlert && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ef4444',
                    color: '#fff',
                    padding: '1.5rem 3rem',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
                    zIndex: 9999,
                    textAlign: 'center',
                    border: '2px solid #fca5a5',
                    animation: 'pulse 1s infinite'
                }}>
                    <h2 style={{ margin: 0, fontSize: '2rem' }}>🚨 ARRIVAL ALERT</h2>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        Customer for {arrivalAlert.order_number} is waiting outside!
                    </p>
                </div>
            )}
            
            {/* DELETE ACCOUNT MODAL */}
            {showDeleteModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '2px solid #ef4444',
                        borderRadius: '16px',
                        padding: '3rem',
                        maxWidth: '500px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
                        <h2 style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '1rem' }}>DANGER ZONE</h2>
                        <p style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '1rem', lineHeight: '1.6' }}>
                            You are about to permanently delete your entire shop.
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.6' }}>
                            This action is <strong>irreversible</strong>. All your menu items, customer orders, finance history, and account settings will be erased forever. 
                        </p>
                        
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                            <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                To confirm deletion, type <strong>DELETE</strong> below:
                            </p>
                            <input 
                                type="text"
                                style={{ width: '100%', padding: '1rem', background: '#000', border: '1px solid #ef4444', color: '#ef4444', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', outline: 'none' }}
                                value={deleteConfirmationWord}
                                onChange={(e) => setDeleteConfirmationWord(e.target.value)}
                                placeholder="DELETE"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteConfirmationWord('');
                                }}
                                className="btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={async () => {
                                    if (deleteConfirmationWord !== 'DELETE') return;
                                    try {
                                        setIsDeletingAccount(true);
                                        // 1. Delete Vendor mapping (cascade drops data if FK set up, else rely on Auth trigger)
                                        // But the most robust way in a client is to call an Edge Function or just delete the auth user.
                                        // To delete the current user securely, Supabase provides admin API or they need to execute custom RPC.
                                        // Using standard client, a user can't easily self-delete from auth.users unless we have an RPC.
                                        // A simple workaround for this platform is deleting the vendor profile to ghost the account.
                                        await supabase.from('vendors').delete().eq('id', currentVendorId);
                                        await supabase.from('profiles').delete().eq('id', session.user.id);
                                        // We log them out
                                        await supabase.auth.signOut();
                                        window.location.reload();
                                    } catch (err) {
                                        alert("Failed to delete account. Please contact support.");
                                        setIsDeletingAccount(false);
                                    }
                                }}
                                disabled={deleteConfirmationWord !== 'DELETE' || isDeletingAccount}
                                style={{ 
                                    flex: 1, 
                                    background: deleteConfirmationWord === 'DELETE' ? '#ef4444' : '#475569', 
                                    color: '#fff', 
                                    border: 'none', 
                                    padding: '1rem', 
                                    borderRadius: '8px', 
                                    fontWeight: 'bold', 
                                    cursor: deleteConfirmationWord === 'DELETE' ? 'pointer' : 'not-allowed' 
                                }}
                            >
                                {isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="kds-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="kds-brand" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('kds')}>
                        VulaHub <span>KDS</span>
                    </div>
                    {vendorConfig && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ padding: '0.25rem 0.75rem', background: 'rgba(0, 230, 118, 0.1)', color: '#00e676', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(0, 230, 118, 0.2)' }}>
                                🏪 {vendorConfig.name}
                            </div>
                            <a 
                                href={`/v/${vendorConfig.slug}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ 
                                    padding: '0.25rem 0.75rem', 
                                    background: 'rgba(59, 130, 246, 0.1)', 
                                    color: '#60a5fa', 
                                    borderRadius: '20px', 
                                    fontSize: '0.8rem', 
                                    fontWeight: 'bold', 
                                    textDecoration: 'none',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                🌐 View Live Shop
                            </a>
                        </div>
                    )}
                </div>

                <div className="kds-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'kds' ? 'active' : ''}`}
                        onClick={() => setActiveTab('kds')}
                    >🔥 Live Kitchen <span style={{ color: '#00e676', marginLeft: '0.5rem', fontWeight: 'bold' }}>{liveTime}</span></button>
                    <button
                        className={`tab-btn ${activeTab === 'support' ? 'active' : ''}`}
                        onClick={() => setActiveTab('support')}
                    >💬 Live Chat</button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >🗄️ History Vault</button>
                    <button
                        className={`tab-btn ${activeTab === 'finances' ? 'active' : ''}`}
                        onClick={() => setActiveTab('finances')}
                    >💰 Finances</button>
                    <button
                        className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inventory')}
                    >📦 Inventory</button>
                    <button
                        className={`tab-btn ${activeTab === 'logistics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logistics')}
                    >🚚 Logistics</button>
                    <button
                        className={`tab-btn ${activeTab === 'cms' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('cms');
                        }}
                    >⚙️ CMS Settings</button>
                    <button
                        className={`tab-btn ${activeTab === 'help' ? 'active' : ''}`}
                        onClick={() => setActiveTab('help')}
                    >❓ Help Center</button>
                </div>

                <div className="kds-controls" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Stall Filter:</label>
                        <select
                            className="kds-select"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                        >
                            <option value="all">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    
                    {/* User Profile Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                            style={{ 
                                background: '#1e293b', 
                                color: '#fff', 
                                border: '1px solid #334155', 
                                padding: '0.5rem', 
                                borderRadius: '50%', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                fontSize: '1.2rem'
                            }}
                        >
                            👤
                        </button>
                        
                        {isProfileMenuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: '0',
                                marginTop: '0.5rem',
                                background: '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                overflow: 'hidden',
                                zIndex: 1000,
                                minWidth: '180px'
                            }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #334155', background: '#0f172a' }}>
                                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem' }}>{profile?.full_name || 'Admin User'}</p>
                                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>{session?.user?.email}</p>
                                </div>
                                <div style={{ padding: '0.5rem' }}>
                                    <button 
                                        onClick={() => {
                                            setIsVaultUnlocked(false);
                                            setVaultPassword('');
                                            setVaultError('');
                                            setActiveTab('kds'); // Reset background tab
                                            // Explicitly trigger the security check by entering a special 'vault' mode
                                            setIsProfileMenuOpen(false);
                                            // We will use isVaultUnlocked + a new state 'isEnteringVault' if needed, 
                                            // but for now, we'll repurpose the 'activeTab' logic to trigger the overlay.
                                            setActiveTab('integrations'); 
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            background: 'transparent', 
                                            border: 'none', 
                                            color: '#fff', 
                                            padding: '0.75rem 1rem', 
                                            textAlign: 'left', 
                                            cursor: 'pointer',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            gap: '0.5rem',
                                            alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    >
                                        🔒 Security Vault
                                    </button>
                                    <div style={{ height: '1px', background: '#334155', margin: '0.25rem 0' }}></div>
                                    <button 
                                        onClick={handleLogout}
                                        style={{ 
                                            width: '100%', 
                                            background: 'transparent', 
                                            border: 'none', 
                                            color: '#f87171', 
                                            padding: '0.75rem 1rem', 
                                            textAlign: 'left', 
                                            cursor: 'pointer',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            gap: '0.5rem',
                                            alignItems: 'center',
                                            fontWeight: 'bold'
                                        }}
                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    >
                                        🚪 Logout
                                    </button>
                                    
                                    <div style={{ height: '1px', background: '#334155', margin: '0.25rem 0' }}></div>
                                    <button 
                                        onClick={() => {
                                            setShowDeleteModal(true);
                                            setIsProfileMenuOpen(false);
                                        }}
                                        style={{ 
                                            width: '100%', 
                                            background: 'transparent', 
                                            border: 'none', 
                                            color: '#ef4444', 
                                            padding: '0.75rem 1rem', 
                                            textAlign: 'left', 
                                            cursor: 'pointer',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            gap: '0.5rem',
                                            alignItems: 'center',
                                            fontWeight: 'bold',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = '#ef4444';
                                            e.target.style.color = '#fff';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = 'transparent';
                                            e.target.style.color = '#ef4444';
                                        }}
                                    >
                                        ⚠️ Delete Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* SECURITY VAULT OVERLAY */}
            {activeTab === 'integrations' && (
                <div className="security-vault-overlay">
                    <div className="vault-container-inner">
                        {/* Progressive Timer Bar */}
                        {isVaultUnlocked && (
                            <div className="vault-timer-container">
                                <div 
                                    className={`vault-timer-bar ${vaultTimer < 5 ? 'critical vault-timer-pulse' : ''}`} 
                                    style={{ width: `${(vaultTimer / 20) * 100}%` }}
                                ></div>
                            </div>
                        )}

                        <div className="vault-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>🔒</span>
                                <div>
                                    <h2 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>High-Security Vault</h2>
                                    {isVaultUnlocked && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <small style={{ color: vaultTimer < 5 ? '#ef4444' : '#94a3b8' }}>Auto-locking in {vaultTimer}s</small>
                                            {vaultActiveSection && (
                                                <small style={{ color: '#00e676', fontWeight: 'bold' }}>• Viewing {vaultActiveSection.toUpperCase()}</small>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsVaultUnlocked(false);
                                    setVaultActiveSection(null);
                                    setActiveTab('kds');
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
                            >✕</button>
                        </div>

                        {!isVaultUnlocked ? (
                            <div style={{ padding: '3rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>🔐</div>
                                <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Vault Access Required</h2>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
                                    Please enter your password to view and edit sensitive API keys. This session will auto-lock after 20 seconds of inactivity.
                                </p>
                                
                                {vaultError && (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                                        ❌ {vaultError}
                                    </div>
                                )}

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setUnlocking(true);
                                    setVaultError('');
                                    try {
                                        const { error } = await supabase.auth.signInWithPassword({
                                            email: session.user.email,
                                            password: vaultPassword
                                        });
                                        if (error) throw error;
                                        setIsVaultUnlocked(true);
                                        setVaultPassword('');
                                        setVaultTimer(20); // Reset timer on successful unlock
                                    } catch (err) {
                                        setVaultError('Invalid password. Access denied.');
                                    } finally {
                                        setUnlocking(false);
                                    }
                                }} style={{ maxWidth: '300px', margin: '0 auto' }}>
                                    <input 
                                        type="password" 
                                        className="kds-input" 
                                        placeholder="••••••••" 
                                        required
                                        autoFocus
                                        value={vaultPassword}
                                        onChange={(e) => setVaultPassword(e.target.value)}
                                        style={{ marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={unlocking}
                                        className="btn-primary" 
                                        style={{ width: '100%', padding: '1rem' }}
                                    >
                                        {unlocking ? 'Unlocking...' : '🔓 Open Vault'}
                                                                        </button>
                                </form>
                            </div>
                        ) : (
                            <div style={{ padding: '2rem', maxHeight: '75vh', overflowY: 'auto' }}>
                                {/* Vault Content Switcher */}
                                {!vaultActiveSection ? (
                                    <>
                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                            Select a category to view or update your secure integration settings.
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                            <div className="vault-card" onClick={() => setVaultActiveSection('paystack')}>
                                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💳</div>
                                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Paystack</h3>
                                                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>Payment processing keys</p>
                                            </div>
                                            <div className="vault-card" onClick={() => setVaultActiveSection('netcash')}>
                                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💸</div>
                                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Netcash</h3>
                                                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>Alternative payments</p>
                                            </div>
                                            <div className="vault-card" onClick={() => setVaultActiveSection('domains')}>
                                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌐</div>
                                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Custom Domains</h3>
                                                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>DNS & Branding URLs</p>
                                            </div>
                                            <div className="vault-card" onClick={() => setVaultActiveSection('whatsapp')}>
                                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🟢</div>
                                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>WhatsApp Bot</h3>
                                                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>Automated notifications</p>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                                        <button 
                                            onClick={() => setVaultActiveSection(null)}
                                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                            ← Back to All Categories
                                        </button>

                                        {/* Paystack View */}
                                        {vaultActiveSection === 'paystack' && (
                                            <div style={{ maxWidth: '500px' }}>
                                                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    💳 Paystack Settings
                                                </h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Public Key</label>
                                                        <input 
                                                            type="text" 
                                                            className="kds-input" 
                                                            value={vendorConfig?.paystack_public_key || ''}
                                                            onChange={(e) => setVendorConfig({...vendorConfig, paystack_public_key: e.target.value})}
                                                            placeholder="pk_..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Secret Key</label>
                                                        <input 
                                                            type="password" 
                                                            className="kds-input" 
                                                            value={vendorConfig?.paystack_secret_key || ''}
                                                            onChange={(e) => setVendorConfig({...vendorConfig, paystack_secret_key: e.target.value})}
                                                            placeholder="sk_..."
                                                        />
                                                    </div>
                                                    <button 
                                                        disabled={isSavingVault}
                                                        className="btn-primary" 
                                                        style={{ marginTop: '1rem', background: '#00e676', color: '#000' }}
                                                        onClick={async () => {
                                                            setIsSavingVault(true);
                                                            const { error } = await supabase.from('vendors').update({
                                                                paystack_public_key: vendorConfig.paystack_public_key,
                                                                paystack_secret_key: vendorConfig.paystack_secret_key
                                                            }).eq('id', currentVendorId);
                                                            setIsSavingVault(false);
                                                            if (error) alert("Save failed: " + error.message);
                                                            else alert("Paystack keys updated! 💳");
                                                        }}
                                                    >
                                                        {isSavingVault ? 'Saving...' : '💾 Save Paystack Keys'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Netcash View */}
                                        {vaultActiveSection === 'netcash' && (
                                            <div style={{ maxWidth: '500px' }}>
                                                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    💸 Netcash Settings
                                                </h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Account Service Key</label>
                                                        <input 
                                                            type="text" 
                                                            className="kds-input" 
                                                            value={vendorConfig?.netcash_config?.account_service_key || ''}
                                                            onChange={(e) => setVendorConfig({...vendorConfig, netcash_config: {...vendorConfig.netcash_config, account_service_key: e.target.value}})}
                                                            placeholder="Enter Netcash key"
                                                        />
                                                    </div>
                                                    <button 
                                                        disabled={isSavingVault}
                                                        className="btn-primary" 
                                                        style={{ marginTop: '1rem', background: '#00e676', color: '#000' }}
                                                        onClick={async () => {
                                                            setIsSavingVault(true);
                                                            const { error } = await supabase.from('vendors').update({
                                                                netcash_config: vendorConfig.netcash_config
                                                            }).eq('id', currentVendorId);
                                                            setIsSavingVault(false);
                                                            if (error) alert("Save failed: " + error.message);
                                                            else alert("Netcash settings updated! 💸");
                                                        }}
                                                    >
                                                        {isSavingVault ? 'Saving...' : '💾 Save Netcash Settings'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* WhatsApp View */}
                                        {vaultActiveSection === 'whatsapp' && (
                                            <div style={{ maxWidth: '500px' }}>
                                                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    🟢 WhatsApp Settings
                                                </h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Meta Access Token</label>
                                                        <input 
                                                            type="password" 
                                                            className="kds-input" 
                                                            value={vendorConfig?.whatsapp_config?.access_token || ''}
                                                            onChange={(e) => setVendorConfig({...vendorConfig, whatsapp_config: {...vendorConfig.whatsapp_config, access_token: e.target.value}})}
                                                            placeholder="EAAB..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Phone Number ID</label>
                                                        <input 
                                                            type="text" 
                                                            className="kds-input" 
                                                            value={vendorConfig?.whatsapp_config?.phone_number_id || ''}
                                                            onChange={(e) => setVendorConfig({...vendorConfig, whatsapp_config: {...vendorConfig.whatsapp_config, phone_number_id: e.target.value}})}
                                                            placeholder="1029..."
                                                        />
                                                    </div>
                                                    <button 
                                                        disabled={isSavingVault}
                                                        className="btn-primary" 
                                                        style={{ marginTop: '1rem', background: '#00e676', color: '#000' }}
                                                        onClick={async () => {
                                                            setIsSavingVault(true);
                                                            const { error } = await supabase.from('vendors').update({
                                                                whatsapp_config: vendorConfig.whatsapp_config
                                                            }).eq('id', currentVendorId);
                                                            setIsSavingVault(false);
                                                            if (error) alert("Save failed: " + error.message);
                                                            else alert("WhatsApp settings updated! 🟢");
                                                        }}
                                                    >
                                                        {isSavingVault ? 'Saving...' : '💾 Save WhatsApp Settings'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Domains View */}
                                        {vaultActiveSection === 'domains' && (
                                            <div style={{ maxWidth: '600px' }}>
                                                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    🌐 Domain Configuration
                                                </h3>
                                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                                                    <strong>📋 Required DNS Records</strong>
                                                    Connect domain via registrar:
                                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                                                            <div style={{ fontSize: '0.8rem' }}>Type: <strong>A</strong> | Host: <code>@</code> | Value: <code>76.76.21.21</code></div>
                                                        </div>
                                                        <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '6px', border: '1px solid #334155' }}>
                                                            <div style={{ fontSize: '0.8rem' }}>Type: <strong>CNAME</strong> | Host: <code>www</code> | Value: <code>cname.vercel-dns.com</code></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.5rem' }}>Your Custom Domain</label>
                                                    <input 
                                                        type="text" 
                                                        className="kds-input" 
                                                        value={vendorConfig?.custom_domain || ''}
                                                        onChange={(e) => setVendorConfig({...vendorConfig, custom_domain: e.target.value})}
                                                        placeholder="www.yourname.co.za"
                                                    />
                                                    <button 
                                                        disabled={isSavingVault}
                                                        className="btn-primary" 
                                                        style={{ marginTop: '1rem', background: '#00e676', color: '#000' }}
                                                        onClick={async () => {
                                                            setIsSavingVault(true);
                                                            const { error } = await supabase.from('vendors').update({
                                                                custom_domain: vendorConfig.custom_domain
                                                            }).eq('id', currentVendorId);
                                                            setIsSavingVault(false);
                                                            if (error) alert("Save failed: " + error.message);
                                                            else alert("Custom domain updated! 🌐");
                                                        }}
                                                    >
                                                        {isSavingVault ? 'Saving...' : '💾 Verify & Link Domain'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'kds' && (
                <div className="kds-columns">
                    {/* Column 1: New / Paid */}
                    <div className="kds-col kds-col-new">
                        <h2>📥 NEW ORDERS ({newOrders.length})</h2>
                        <div className="kds-list">
                            {newOrders.map(o => <OrderCard key={o.id} order={o} updateOrderStatus={updateOrderStatus} showLocation={selectedLocation === 'all'} setIsVerifyingPin={setIsVerifyingPin} setVerificationPin={setVerificationPin} setPinError={setPinError} />)}
                            {newOrders.length === 0 && <p className="empty-state">No new orders.</p>}
                        </div>
                    </div>

                    {/* Column 2: Preparing */}
                    <div className="kds-col kds-col-prep">
                        <h2>🍳 PREPARING ({prepOrders.length})</h2>
                        <div className="kds-list">
                            {prepOrders.map(o => <OrderCard key={o.id} order={o} updateOrderStatus={updateOrderStatus} showLocation={selectedLocation === 'all'} setIsVerifyingPin={setIsVerifyingPin} setVerificationPin={setVerificationPin} setPinError={setPinError} />)}
                            {prepOrders.length === 0 && <p className="empty-state">Kitchen is clear.</p>}
                        </div>
                    </div>

                    {/* Column 3: Ready */}
                    <div className="kds-col kds-col-ready">
                        <h2>🛍️ READY FOR COLLECTION ({readyOrders.length})</h2>
                        <div className="kds-list">
                            {readyOrders.map(o => <OrderCard key={o.id} order={o} updateOrderStatus={updateOrderStatus} showLocation={selectedLocation === 'all'} setIsVerifyingPin={setIsVerifyingPin} setVerificationPin={setVerificationPin} setPinError={setPinError} />)}
                            {readyOrders.length === 0 && <p className="empty-state">No orders awaiting pickup.</p>}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'logistics' && (
                <div className="cms-editor" style={{ maxWidth: '900px', margin: '2rem auto' }}>
                    <div className="cms-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            <div>
                                <h2 style={{ color: '#00e676', margin: 0 }}>🚚 Logistics & Delivery Manager</h2>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Configure delivery availability and fees for each of your branches.</p>
                            </div>
                            <button 
                                className="btn-primary" 
                                disabled={isSavingLogistics}
                                onClick={async () => {
                                    setIsSavingLogistics(true);
                                    try {
                                        for (const loc of locations) {
                                            const { error } = await supabase
                                                .from('locations')
                                                .update({
                                                    delivery_enabled: loc.delivery_enabled,
                                                    delivery_fee: loc.delivery_fee
                                                })
                                                .eq('id', loc.id);
                                            if (error) throw error;
                                        }
                                        alert("Logistics updated successfully! 🚚");
                                    } catch (err) {
                                        alert("Error saving logistics: " + err.message);
                                    } finally {
                                        setIsSavingLogistics(false);
                                    }
                                }}
                            >
                                {isSavingLogistics ? 'Saving...' : '💾 Save Logistics Config'}
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                            {locations.map(loc => (
                                <div key={loc.id} style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>📍 {loc.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: loc.delivery_enabled ? '#00e676' : '#64748b' }}>
                                                {loc.delivery_enabled ? 'Delivery ON' : 'Delivery OFF'}
                                            </span>
                                            <label className="switch" style={{ width: '40px', height: '20px' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={loc.delivery_enabled || false}
                                                    onChange={(e) => {
                                                        const updated = locations.map(l => l.id === loc.id ? { ...l, delivery_enabled: e.target.checked } : l);
                                                        setLocations(updated);
                                                    }}
                                                />
                                                <span className="slider round"></span>
                                            </label>
                                        </div>
                                    </div>

                                    {loc.delivery_enabled && (
                                        <div className="form-group" style={{ animation: 'slideDown 0.3s ease-out' }}>
                                            <label style={{ fontSize: '0.85rem' }}>Delivery Fee (ZAR)</label>
                                            <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>R</span>
                                                <input 
                                                    type="number" 
                                                    className="kds-input" 
                                                    style={{ paddingLeft: '2.5rem' }}
                                                    value={loc.delivery_fee || 0}
                                                    onChange={(e) => {
                                                        const updated = locations.map(l => l.id === loc.id ? { ...l, delivery_fee: parseFloat(e.target.value) || 0 } : l);
                                                        setLocations(updated);
                                                    }}
                                                />
                                            </div>
                                            <small style={{ color: '#64748b', marginTop: '0.5rem', display: 'block' }}>This fee will be added to the customer's total at checkout.</small>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'support' && (
                <div className="vault-container" style={{ display: 'flex', height: 'calc(100vh - 150px)', overflow: 'hidden', padding: 0 }}>
                    {/* Security PIN Verification Modal */}
                    {isVerifyingPin && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(15, 23, 42, 0.95)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10000,
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div className="cms-card" style={{ width: '400px', textAlign: 'center', border: '1px solid rgba(0, 230, 118, 0.3)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                                <h2 style={{ color: '#00e676', marginBottom: '0.5rem' }}>Verify Collection PIN</h2>
                                <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                                    Enter the 4-digit secret PIN from <strong>{isVerifyingPin.customer_name}'s</strong> order to verify hand-off.
                                </p>
                                
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <input 
                                        type="text" 
                                        maxLength="4" 
                                        autoFocus
                                        value={verificationPin}
                                        onChange={(e) => setVerificationPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="0000"
                                        style={{ 
                                            width: '100%', 
                                            background: '#0f172a', 
                                            border: '2px solid #334155', 
                                            borderRadius: '12px', 
                                            padding: '1rem', 
                                            color: '#fff', 
                                            fontSize: '2rem', 
                                            textAlign: 'center',
                                            letterSpacing: '1rem',
                                            fontWeight: 'bold'
                                        }}
                                    />
                                    {pinError && <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.85rem' }}>{pinError}</p>}
                                </div>

                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button 
                                        className="btn-secondary" 
                                        style={{ flex: 1 }}
                                        onClick={() => setIsVerifyingPin(null)}
                                    >Cancel</button>
                                    <button 
                                        className="btn-primary" 
                                        style={{ flex: 2, background: '#00e676', color: '#000' }}
                                        onClick={() => {
                                            if (verificationPin === isVerifyingPin.collection_pin) {
                                                updateOrderStatus(isVerifyingPin.id, 'completed');
                                                setIsVerifyingPin(null);
                                            } else {
                                                setPinError("Invalid PIN. Please ask the customer for the code on their receipt.");
                                            }
                                        }}
                                    >Verify & Complete</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Left Pane: Sessions */}
                    <div style={{ width: '350px', background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid #334155', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>💬 Active Chats</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button 
                                    onClick={() => setChatMode('active')}
                                    style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', background: chatMode === 'active' ? '#00e676' : 'transparent', color: chatMode === 'active' ? '#000' : '#94a3b8', border: '1px solid #334155', cursor: 'pointer' }}
                                >Active</button>
                                <button 
                                    onClick={() => setChatMode('history')}
                                    style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', background: chatMode === 'history' ? '#00e676' : 'transparent', color: chatMode === 'history' ? '#000' : '#94a3b8', border: '1px solid #334155', cursor: 'pointer' }}
                                >History</button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {/* Group chats by session_identifier and filter by order status */}
                            {Array.from(new Set(chats.map(c => c.session_identifier))).filter(sessionId => {
                                const order = [...orders, ...historyOrders].find(o => o.order_number === sessionId);
                                if (chatMode === 'active') {
                                    return !order || (order.status !== 'completed' && order.status !== 'refunded');
                                } else {
                                    return order && (order.status === 'completed' || order.status === 'refunded');
                                }
                            }).map(sessionId => {
                                const sessionChats = chats.filter(c => c.session_identifier === sessionId);
                                const lastChat = sessionChats[sessionChats.length - 1];
                                const unread = sessionChats.filter(c => c.sender_type === 'customer' && !c.is_read).length;
                                return (
                                    <div 
                                        key={sessionId} 
                                        onClick={() => {
                                            setActiveChatSession(sessionId);
                                            // Optional: Mark as read logic
                                        }}
                                        style={{ 
                                            padding: '1rem', 
                                            borderBottom: '1px solid #334155', 
                                            cursor: 'pointer',
                                            background: activeChatSession === sessionId ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            borderLeft: activeChatSession === sessionId ? '4px solid #3b82f6' : '4px solid transparent'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <strong style={{ color: '#f8fafc' }}>Order: {sessionId}</strong>
                                            {unread > 0 && <span style={{ background: '#ef4444', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>{unread}</span>}
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {lastChat.message}
                                        </p>
                                    </div>
                                );
                            })}
                            {chats.length === 0 && <p style={{ padding: '1rem', color: '#64748b', textAlign: 'center' }}>No messages yet.</p>}
                        </div>
                    </div>

                    {/* Right Pane: Chat Thread */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
                        {activeChatSession ? (
                            <>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #334155', background: '#1e293b' }}>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Chatting with Order: {activeChatSession}</h2>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {chats.filter(c => c.session_identifier === activeChatSession).map(chat => {
                                        const isVendor = chat.sender_type === 'admin';
                                        return (
                                            <div key={chat.id} style={{ 
                                                alignSelf: isVendor ? 'flex-end' : 'flex-start',
                                                background: isVendor ? '#3b82f6' : '#334155',
                                                color: '#fff',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '12px',
                                                borderBottomRightRadius: isVendor ? '0' : '12px',
                                                borderBottomLeftRadius: !isVendor ? '0' : '12px',
                                                maxWidth: '70%',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}>
                                                <div style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{chat.message}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem', textAlign: isVendor ? 'right' : 'left' }}>
                                                    {new Date(chat.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ padding: '1rem', borderTop: '1px solid #334155', background: '#1e293b' }}>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!newAdminMessage.trim()) return;
                                        const { error } = await supabase.from('support_chats').insert({
                                            vendor_id: currentVendorId,
                                            session_identifier: activeChatSession,
                                            sender_type: 'admin',
                                            message: newAdminMessage.trim()
                                        });
                                        if (error) alert("Send failed: " + error.message);
                                        else setNewAdminMessage('');
                                    }} style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input 
                                            type="text" 
                                            value={newAdminMessage}
                                            onChange={(e) => setNewAdminMessage(e.target.value)}
                                            placeholder="Type a reply..." 
                                            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: '#fff', outline: 'none' }}
                                        />
                                        <button type="submit" className="btn-primary" style={{ padding: '0 1.5rem', fontWeight: 'bold' }}>Send</button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                Select a session from the left to start chatting.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'help' && (
                <div className="vault-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#60a5fa' }}>👋 Welcome to the Help Center!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Here is everything you need to know about your shop, explained simply so even a 10-year-old could run it.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Section 1 */}
                        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#00e676', marginBottom: '1rem' }}>🔥 Live Kitchen</h3>
                            <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                Think of the <strong>Live Kitchen</strong> as the beating heart of your shop. When a customer orders online or via WhatsApp, a magic ticket pops up here under "New Orders." 
                            </p>
                            <ul style={{ color: '#cbd5e1', marginTop: '1rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <li>Click <strong>Start Preparing</strong> when you put the kota in the pan. The customer gets told you are cooking!</li>
                                <li>Click <strong>Mark Ready</strong> when it is in the box.</li>
                                <li>Click <strong>Collected / Done</strong> when you hand it to the customer, and the ticket goes to the History vault.</li>
                            </ul>
                        </div>

                        {/* Section 2 */}
                        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#3b82f6', marginBottom: '1rem' }}>💬 Live Chat</h3>
                            <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                This is your secret walkie-talkie to your customers. If they get confused or want to change their order, they will send a message from their phone, and you will see it here. Just click their order number and type back!
                            </p>
                        </div>

                        {/* Section 3 */}
                        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#f59e0b', marginBottom: '1rem' }}>💰 Finances & 📦 Inventory</h3>
                            <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                <strong>Finances:</strong> This is your piggy bank. Every time a customer pays, money goes up! If you buy tomatoes, log it as an "Expense" so the piggy bank knows exactly how much you really made (Net Profit).
                                <br/><br/>
                                <strong>Inventory:</strong> If you start the day with 50 polony slices, tell the Inventory. Every time you make a Kota, the system automatically subtracts it for you!
                            </p>
                        </div>

                        {/* Section 4 */}
                        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#8b5cf6', marginBottom: '1rem' }}>⚙️ CMS Settings</h3>
                            <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                The <strong>CMS</strong> (Content Management System) is your magic paintbrush. It lets you change your shop name, colors, add new items to the menu (like a new special chips), and set up new Stalls. Anything you change here instantly updates on the customer's phone!
                            </p>
                        </div>

                        {/* Section 5 */}
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', color: '#f87171', marginBottom: '1rem' }}>👤 Profile Dropdown (Top Right)</h3>
                            <p style={{ color: '#cbd5e1', lineHeight: '1.6' }}>
                                See that little person icon in the top right corner? That's your private key. 
                                <br/><br/>
                                Click it to open the <strong>Security Vault</strong>. The Security Vault is heavily guarded (you need a password!) and holds the "API Keys" that connect your shop directly to Paystack banks so you get paid. Keep it locked!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="vault-container">
                    <div className="vault-header">
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Completed Order History</h2>
                            <p style={{ color: '#94a3b8' }}>All collected and closed orders appear here.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select 
                                className="kds-select" 
                                value={historyFilter} 
                                onChange={e => setHistoryFilter(e.target.value)}
                                style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.1)' }}
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today's Orders</option>
                            </select>
                            <button className="btn-secondary" onClick={exportToCSV}>📊 Active Queue CSV</button>
                            <button className="btn-primary" onClick={exportPDF}>📄 Download PDF Report</button>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="vault-table">
                            <thead>
                                <tr>
                                    <th>Order Number</th>
                                    <th>Date Completed</th>
                                    <th>Customer Log (CRM)</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedHistoryOrders.map(o => (
                                    <tr key={o.id}>
                                        <td><strong>{o.order_number}</strong></td>
                                        <td>{new Date(o.updated_at || o.created_at).toLocaleString()}</td>
                                        <td>
                                            {o.customer_name} ({o.customer_phone})<br />
                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>📍 {o.locations?.name || 'Local'}</span>
                                        </td>
                                        <td>
                                            {o.order_items?.map(i => `${i.quantity}x ${i.menu_items?.name}`).join(', ')}
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: '#00e676' }}>R {o.total_price}</td>
                                    </tr>
                                ))}
                                {displayedHistoryOrders.length === 0 && (
                                    <tr><td colSpan="5" className="empty-state">No historical orders found. Make some sales!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'finances' && (
                <div className="vault-container">
                    <div className="vault-header" style={{ marginBottom: '1rem', paddingBottom: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Financial Ledger & Net Profit</h2>
                            <p style={{ color: '#94a3b8' }}>Real-time revenue tracking versus logged expenses.</p>
                        </div>
                    </div>

                    {/* Financial Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="kds-card" style={{ borderLeftColor: '#34d399', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Total Gross Revenue</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>R {totalRevenue.toFixed(2)}</div>
                        </div>
                        <div className="kds-card" style={{ borderLeftColor: '#f43f5e', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Total Expenses</h3>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fb7185' }}>R {totalExpenses.toFixed(2)}</div>
                        </div>
                        <div className="kds-card" style={{ borderLeftColor: netProfit >= 0 ? '#3b82f6' : '#f43f5e', textAlign: 'center', padding: '1.5rem' }}>
                            <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.5rem' }}>Net Profit</h3>
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: netProfit >= 0 ? '#60a5fa' : '#fb7185' }}>
                                R {netProfit.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Expense Form & List */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                        <div className="kds-card" style={{ padding: '1.5rem', height: 'max-content' }}>
                            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>⚡ Quick Add Expense</h3>
                            <form className="checkout-form" onSubmit={handleAddExpense}>
                                <div className="form-group">
                                    <label>Expense Description</label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        placeholder="e.g. Bought 2L Oil"
                                        value={newExpense.description}
                                        onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Amount (ZAR)</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        step="0.01"
                                        className="form-input"
                                        placeholder="e.g. 150"
                                        value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Receipt Photo (Optional)</label>
                                    <input
                                        type="file"
                                        id="receipt-upload"
                                        accept="image/*,application/pdf"
                                        className="form-input"
                                        onChange={(e) => setNewExpense({ ...newExpense, receiptFile: e.target.files[0] })}
                                    />
                                </div>
                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }} disabled={uploadingReceipt}>
                                    {uploadingReceipt ? 'Uploading...' : 'Log Expense'}
                                </button>
                            </form>
                        </div>

                        <div className="table-responsive">
                            <table className="vault-table">
                                <thead>
                                    <tr>
                                        <th>Date Logged</th>
                                        <th>Description</th>
                                        <th>Receipt</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(e => (
                                        <tr key={e.id}>
                                            <td>{new Date(e.created_at).toLocaleDateString()}</td>
                                            <td>{e.description}</td>
                                            <td>
                                                {e.receipt_url
                                                    ? <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>View Receipt</a>
                                                    : <span style={{ color: '#64748b' }}>-</span>
                                                }
                                            </td>
                                            <td style={{ color: '#fca5a5', fontWeight: 'bold' }}>- R {e.amount}</td>
                                        </tr>
                                    ))}
                                    {expenses.length === 0 && (
                                        <tr><td colSpan="4" className="empty-state">No expenses logged yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="vault-container">
                    <div className="vault-header">
                        <div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Live Ingredient Inventory</h2>
                            <p style={{ color: '#94a3b8' }}>Manage raw ingredients. Stock automatically deducts when Kitchen Staff click "Start Preparing".</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={fetchInitialData}>🔄 Refresh</button>
                            <button className="btn-primary" onClick={() => setIsAddingIngredient(!isAddingIngredient)}>
                                {isAddingIngredient ? 'Cancel' : '➕ Add Ingredient'}
                            </button>
                        </div>
                    </div>

                    {isAddingIngredient && (
                        <div className="kds-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                                <h3>{editingIngredient.id ? "Edit Ingredient" : "Add New Ingredient"}</h3>
                                {editingIngredient.id && (
                                    <button className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                                        setEditingIngredient({ id: null, name: '', unit: '', current_stock: '', low_stock_threshold: '' });
                                        setIsAddingIngredient(false);
                                    }}>Cancel Edit</button>
                                )}
                            </div>
                            <form className="checkout-form" onSubmit={handleSaveIngredient} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Ingredient Name</label>
                                    <input type="text" required className="form-input" placeholder="e.g. Eggs" value={editingIngredient.name} onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Unit Metric</label>
                                    <input type="text" required className="form-input" placeholder="e.g. units, kg, lit" value={editingIngredient.unit} onChange={(e) => setEditingIngredient({ ...editingIngredient, unit: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Current Stock Level</label>
                                    <input type="number" required className="form-input" placeholder="0" value={editingIngredient.current_stock} onChange={(e) => setEditingIngredient({ ...editingIngredient, current_stock: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Low Stock Alert At</label>
                                    <input type="number" required className="form-input" placeholder="10" value={editingIngredient.low_stock_threshold} onChange={(e) => setEditingIngredient({ ...editingIngredient, low_stock_threshold: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <button type="submit" className="btn-primary" style={{ height: '48px', width: '100%' }}>{editingIngredient.id ? "Save Changes" : "Save Ingredient"}</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="table-responsive">
                        <table className="vault-table">
                            <thead>
                                <tr>
                                    <th>Ingredient</th>
                                    <th>Unit Metric</th>
                                    <th>Current Stock Level</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ingredients.map(ing => {
                                    const isLow = Number(ing.current_stock) <= Number(ing.low_stock_threshold);
                                    return (
                                        <tr key={ing.id} style={{ borderLeft: isLow ? '4px solid #ef4444' : '4px solid transparent' }}>
                                            <td><strong>{ing.name}</strong></td>
                                            <td>{ing.unit}</td>
                                            <td style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{ing.current_stock}</td>
                                            <td>
                                                {isLow
                                                    ? <span className="status-badge status-paid">Low Stock</span>
                                                    : <span className="status-badge status-ready">Optimal</span>
                                                }
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn-primary"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#3b82f6', color: '#fff' }}
                                                        onClick={() => {
                                                            setEditingIngredient({
                                                                id: ing.id,
                                                                name: ing.name,
                                                                unit: ing.unit,
                                                                current_stock: ing.current_stock.toString(),
                                                                low_stock_threshold: ing.low_stock_threshold.toString()
                                                            });
                                                            setIsAddingIngredient(true);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn-danger"
                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', background: '#ef4444', color: '#fff' }}
                                                        onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {ingredients.length === 0 && (
                                    <tr><td colSpan="5" className="empty-state">No inventory ingredients found. Make sure mapping is complete.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {/* --- PHASE 11: CMS & SETTINGS TAB --- */}
            {activeTab === 'cms' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* CMS Sub-Navigation */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '1rem', 
                        padding: '1rem 2rem', 
                        background: 'rgba(30, 41, 59, 0.5)', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)' 
                    }}>
                        {[
                            { id: 'menu', label: '🍔 Live Menu Manager', icon: '🍔' },
                            { id: 'branches', label: '📍 Branch Manager', icon: '📍' },
                            { id: 'events', label: '🗓️ Mobile Stalls & Events', icon: '🗓️' },
                            { id: 'branding', label: '🎨 Brand & Website Identity', icon: '🎨' }
                        ].map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setCmsActiveSubTab(sub.id)}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: cmsActiveSubTab === sub.id ? '#00e676' : 'rgba(255,255,255,0.1)',
                                    background: cmsActiveSubTab === sub.id ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                                    color: cmsActiveSubTab === sub.id ? '#00e676' : '#94a3b8',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                        
                        {/* 1. Live Menu Manager */}
                        {cmsActiveSubTab === 'menu' && (
                            <div className="finances-card">
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    🍔 Live Menu Manager
                                </h2>

                                {/* Recipe Builder Modal UI */}
                                {editingRecipeFor && (
                                    <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3b82f6', boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                                            <div>
                                                <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '1.25rem' }}>Construct Recipe: {editingRecipeFor.name}</h3>
                                                <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Define how many units of each inventory ingredient are used to make this item.</p>
                                            </div>
                                            <button className="btn-secondary" onClick={() => setEditingRecipeFor(null)}>Cancel</button>
                                        </div>

                                        <div style={{ marginBottom: '1.5rem' }}>
                                            {editingRecipeIngredients.map((row, idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                                                    <select
                                                        className="kds-select"
                                                        value={row.ingredient}
                                                        onChange={(e) => handleRecipeIngredientChange(idx, 'ingredient', e.target.value)}
                                                    >
                                                        <option value="">-- Select Ingredient --</option>
                                                        {ingredients.map(ing => (
                                                            <option key={ing.id} value={ing.name}>{ing.name} ({ing.unit})</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        className="kds-input"
                                                        placeholder="Qty per Item"
                                                        value={row.quantity}
                                                        onChange={(e) => handleRecipeIngredientChange(idx, 'quantity', e.target.value)}
                                                    />
                                                    <button
                                                        className="btn-danger"
                                                        type="button"
                                                        style={{ padding: '0.5rem' }}
                                                        onClick={() => handleRemoveRecipeIngredientRow(idx)}
                                                    >
                                                        ✖
                                                    </button>
                                                </div>
                                            ))}
                                            <button className="btn-secondary" type="button" style={{ marginTop: '0.5rem' }} onClick={handleAddRecipeIngredientRow}>
                                                ➕ Add Another Ingredient
                                            </button>
                                        </div>

                                        <button className="btn-primary" type="button" style={{ width: '100%', background: '#10b981' }} onClick={handleSaveRecipe}>
                                            Save Recipe Logic
                                        </button>
                                    </div>
                                )}

                                {/* Add / Edit Menu Item Form */}
                                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: 0, color: '#00e676', fontSize: '1.1rem' }}>
                                            {editingMenuItem.id ? 'Edit Menu Item' : 'Add New Kota / Item'}
                                        </h3>
                                        {editingMenuItem.id && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingMenuItem({ id: null, name: '', price: '', image_url: '' })}
                                                style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8', borderRadius: '4px', padding: '0.25rem 0.75rem', cursor: 'pointer' }}
                                            >
                                                Cancel Edit
                                            </button>
                                        )}
                                    </div>

                                    <form onSubmit={handleSaveMenuItem} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr auto', gap: '1rem', alignItems: 'end' }}>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Name</label>
                                            <input required type="text" className="kds-input" value={editingMenuItem.name} onChange={e => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })} placeholder="e.g. The Jumbo Special" style={{ width: '100%' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Price (R)</label>
                                            <input required type="number" min="0" step="0.01" className="kds-input" value={editingMenuItem.price} onChange={e => setEditingMenuItem({ ...editingMenuItem, price: e.target.value })} style={{ width: '100%' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Menu Image Upload</label>
                                            {editingMenuItem.image_url && !menuImageFile && (
                                                <div style={{ marginBottom: '0.25rem' }}>
                                                    <img src={editingMenuItem.image_url} alt="Current" style={{ height: '30px', borderRadius: '4px', verticalAlign: 'middle', marginRight: '0.5rem' }} />
                                                    <small style={{ color: '#00e676' }}>Active</small>
                                                </div>
                                            )}
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="kds-input" 
                                                onChange={e => setMenuImageFile(e.target.files[0])} 
                                                style={{ width: '100%', padding: '0.25rem' }} 
                                            />
                                        </div>
                                        <button type="submit" disabled={uploadingMenuImage} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
                                            {uploadingMenuImage ? 'Saving...' : (editingMenuItem.id ? 'Save Changes' : 'Add Item')}
                                        </button>
                                    </form>
                                </div>

                                {/* Existing Menu Items Table */}
                                <div className="table-wrapper">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                                        <thead style={{ background: '#0f172a', textAlign: 'left' }}>
                                            <tr>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Item Name</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Price</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Assigned Image</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {menuItems.map(item => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ padding: '1rem' }}><strong>{item.name}</strong></td>
                                                    <td style={{ padding: '1rem', color: '#00e676' }}>R {item.price}</td>
                                                    <td style={{ padding: '1rem', color: '#94a3b8' }}>{item.image_url || 'None'}</td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        <button
                                                            onClick={() => openRecipeBuilder(item)}
                                                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                                        >
                                                            Build Recipe
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingMenuItem({ id: item.id, name: item.name, price: item.price, image_url: item.image_url || '' })}
                                                            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteMenuItem(item.id, item.name)}
                                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {menuItems.length === 0 && (
                                                <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No menu items found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 2. Branch Manager */}
                        {cmsActiveSubTab === 'branches' && (
                            <div className="finances-card">
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    📍 Branch Manager (Permanent Locations)
                                </h2>
                                <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Manage your physical shop locations. Customers will select these during checkout.</p>

                                {/* Add New Branch Form */}
                                <div style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #334155' }}>
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        setIsSavingBranch(true);
                                        try {
                                            const { error } = await supabase.from('locations').insert({
                                                name: newBranch.name,
                                                vendor_id: currentVendorId,
                                                address: newBranch.address,
                                                google_maps_url: newBranch.google_maps_url,
                                                is_mobile: false,
                                                is_active: true
                                            });
                                            if (error) throw error;
                                            setNewBranch({ name: '', address: '', google_maps_url: '', is_active: true });
                                            fetchInitialData(); // Refresh list
                                            alert("Branch added successfully!");
                                        } catch (err) {
                                            alert("Error saving branch: " + err.message);
                                        } finally {
                                            setIsSavingBranch(false);
                                        }
                                    }} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Branch Name (e.g. Flora Park Shop)</label>
                                            <input 
                                                required 
                                                type="text" 
                                                className="kds-input" 
                                                value={newBranch.name} 
                                                onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} 
                                                placeholder="Enter branch name"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <button type="submit" className="btn-primary" disabled={isSavingBranch} style={{ padding: '0.75rem 2rem' }}>
                                            {isSavingBranch ? 'Saving...' : '➕ Add Branch'}
                                        </button>
                                    </form>
                                </div>

                                <div className="table-wrapper">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f8fafc', background: '#1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                                        <thead style={{ background: '#0f172a', textAlign: 'left' }}>
                                            <tr>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Branch Name</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Type</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Status</th>
                                                <th style={{ padding: '1rem', borderBottom: '1px solid #334155', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {locations.filter(l => !l.is_mobile).map(branch => (
                                                <tr key={branch.id} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ padding: '1rem' }}><strong>{branch.name}</strong></td>
                                                    <td style={{ padding: '1rem' }}><span className="status-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>🏪 Permanent</span></td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <span className={`status-badge ${branch.is_active ? 'status-ready' : 'status-paid'}`}>
                                                            {branch.is_active ? 'Active' : 'Hidden'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <button
                                                            onClick={async () => {
                                                                const { error } = await supabase.from('locations').update({ is_active: !branch.is_active }).eq('id', branch.id);
                                                                if (error) alert("Error: " + error.message);
                                                                else fetchInitialData();
                                                            }}
                                                            style={{ 
                                                                background: branch.is_active ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                                                                color: branch.is_active ? '#ef4444' : '#10b981', 
                                                                border: '1px solid currentColor',
                                                                padding: '0.5rem 1rem', 
                                                                borderRadius: '8px', 
                                                                cursor: 'pointer', 
                                                                fontSize: '0.8rem' 
                                                            }}
                                                        >
                                                            {branch.is_active ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {locations.filter(l => !l.is_mobile).length === 0 && (
                                                <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No permanent branches found. Add your first shop above!</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 3. Mobile Stalls & Events */}
                        {cmsActiveSubTab === 'events' && (
                            <div className="finances-card">
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🗓️ Mobile Stalls & Events</h2>

                                {/* List Existing Stalls */}
                                <div style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '1rem' }}>Active Events</h3>
                                    {locations.filter(l => l.is_mobile).length === 0 ? (
                                        <p style={{ color: '#64748b', fontStyle: 'italic' }}>No mobile stall events scheduled.</p>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '1rem' }}>
                                            {locations.filter(l => l.is_mobile).map(stall => (
                                                <div key={stall.id} style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong style={{ color: '#f8fafc', fontSize: '1.1rem', display: 'block' }}>{stall.name}</strong>
                                                        <span style={{ color: '#00e676', fontSize: '0.9rem' }}>{stall.stall_date || 'No Date Set'}</span>
                                                        <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{stall.banner_text}</p>
                                                    </div>
                                                    <button
                                                        className="btn-kds btn-paid"
                                                        style={{ background: '#ef4444', color: '#fff' }}
                                                        onClick={() => handleDeleteStallEvent(stall.id, stall.name)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <hr style={{ borderColor: '#334155', margin: '2rem 0' }} />

                                <h3 style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '1rem' }}>Add New Event</h3>
                                <form onSubmit={handleAddStallEvent}>
                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Event Name (e.g. Peter Mokaba Popup)</label>
                                                <input
                                                    type="text"
                                                    className="kds-input"
                                                    placeholder="Peter Mokaba Popup"
                                                    value={newStallEvent.name}
                                                    onChange={(e) => setNewStallEvent({ ...newStallEvent, name: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', background: '#334155', border: '1px solid #475569', color: '#f8fafc', borderRadius: '4px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>"Currently At" Announcement Banner</label>
                                                <input
                                                    type="text"
                                                    className="kds-input"
                                                    placeholder="e.g. Catch us outside Gate 2 today!"
                                                    value={newStallEvent.banner_text}
                                                    onChange={(e) => setNewStallEvent({ ...newStallEvent, banner_text: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', background: '#334155', border: '1px solid #475569', color: '#f8fafc', borderRadius: '4px' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Stall Date</label>
                                                <input
                                                    type="text"
                                                    className="kds-input"
                                                    placeholder="e.g. Sat 14 March"
                                                    value={newStallEvent.stall_date}
                                                    onChange={(e) => setNewStallEvent({ ...newStallEvent, stall_date: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', background: '#334155', border: '1px solid #475569', color: '#f8fafc', borderRadius: '4px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Pre-order Start</label>
                                                <input
                                                    type="text"
                                                    className="kds-input"
                                                    placeholder="e.g. Wed 11 March, 9 AM"
                                                    value={newStallEvent.preorder_start_date}
                                                    onChange={(e) => setNewStallEvent({ ...newStallEvent, preorder_start_date: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', background: '#334155', border: '1px solid #475569', color: '#f8fafc', borderRadius: '4px' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem' }}>Pre-order Deadline</label>
                                                <input
                                                    type="text"
                                                    className="kds-input"
                                                    placeholder="e.g. Fri 13 March, 8 PM"
                                                    value={newStallEvent.preorder_deadline}
                                                    onChange={(e) => setNewStallEvent({ ...newStallEvent, preorder_deadline: e.target.value })}
                                                    style={{ width: '100%', padding: '0.75rem', background: '#334155', border: '1px solid #475569', color: '#f8fafc', borderRadius: '4px' }}
                                                />
                                            </div>
                                        </div>
                                        <small style={{ color: '#64748b', display: 'block', marginTop: '1rem' }}>These details will automatically appear on the public landing page in the Locations section.</small>
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={isSavingStall}>
                                        {isSavingStall ? 'Saving...' : 'Add Stall Event'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* 4. Brand & Website Identity */}
                        {cmsActiveSubTab === 'branding' && (
                            <div className="finances-card" style={{ border: '1px solid #00e676' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    🎨 Brand & Website Identity
                                </h2>
                                {vendorConfig ? (
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                            setUploadingHero(true);
                                            let finalBranding = { ...vendorConfig.branding };

                                            if (heroImageFile) {
                                                const fileExt = heroImageFile.name.split('.').pop();
                                                const fileName = `hero_${Date.now()}.${fileExt}`;
                                                const filePath = `hero-images/${fileName}`;

                                                const { error: uploadError } = await supabase.storage
                                                    .from('business-documents')
                                                    .upload(filePath, heroImageFile);

                                                if (uploadError) {
                                                    console.error("Hero upload error:", uploadError);
                                                    alert("Could not upload hero image. Ensure the Storage bucket 'business-documents' exists.");
                                                } else {
                                                    const { data: { publicUrl } } = supabase.storage
                                                        .from('business-documents')
                                                        .getPublicUrl(filePath);
                                                    finalBranding.hero_image = publicUrl;
                                                }
                                            }

                                            const { error } = await supabase.from('vendors').update({
                                                name: vendorConfig.name,
                                                custom_domain: vendorConfig.custom_domain,
                                                branding: finalBranding
                                            }).eq('id', currentVendorId);
                                            
                                            if (error) throw error;
                                            alert("Branding settings updated!");
                                            setVendorConfig({...vendorConfig, branding: finalBranding});
                                        } catch (err) {
                                            alert("Failed to save branding: " + err.message);
                                        } finally {
                                            setUploadingHero(false);
                                        }
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                            <div className="form-group">
                                                <label>Shop Name</label>
                                                <input type="text" className="kds-input" value={vendorConfig.name} onChange={(e) => setVendorConfig({...vendorConfig, name: e.target.value})} />
                                            </div>
                                            <div className="form-group">
                                                <label>Tagline</label>
                                                <input type="text" className="kds-input" value={vendorConfig.branding?.tagline || ''} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, tagline: e.target.value}})} />
                                            </div>
                                            <div className="form-group">
                                                <label>Primary Brand Color</label>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <input type="color" value={vendorConfig.branding?.primary_color || '#00e676'} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, primary_color: e.target.value}})} style={{ height: '48px', width: '60px', padding: '0', background: 'transparent', border: 'none' }} />
                                                    <input type="text" className="kds-input" value={vendorConfig.branding?.primary_color || '#00e676'} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, primary_color: e.target.value}})} />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Welcome Text</label>
                                                <input type="text" className="kds-input" value={vendorConfig.branding?.welcome_text || ''} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, welcome_text: e.target.value}})} />
                                            </div>
                                            <div className="form-group">
                                                <label>Custom Domain (e.g. www.chef-dips.co.za)</label>
                                                <input type="text" className="kds-input" value={vendorConfig.custom_domain || ''} onChange={(e) => setVendorConfig({...vendorConfig, custom_domain: e.target.value})} placeholder="Leave blank to use platform slug" />
                                            </div>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                            <label>Hero Title Highlight</label>
                                            <input type="text" placeholder="e.g. good quality food." className="kds-input" value={vendorConfig.branding?.hero_highlight || ''} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, hero_highlight: e.target.value}})} />
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                            <label>Hero Background Image Upload</label>
                                            {vendorConfig.branding?.hero_image && (
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <img src={vendorConfig.branding.hero_image} alt="Hero" style={{ height: '60px', borderRadius: '4px', border: '1px solid #334155' }} />
                                                    <br/>
                                                    <small style={{ color: '#00e676' }}>Current image active</small>
                                                </div>
                                            )}
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                className="kds-input" 
                                                onChange={(e) => setHeroImageFile(e.target.files[0])} 
                                                style={{ padding: '0.5rem' }}
                                            />
                                            <small style={{ color: '#64748b', display: 'block', marginTop: '0.5rem' }}>Upload a high-quality landscape image for your landing page background.</small>
                                        </div>

                                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                            <label>About Us Story</label>
                                            <textarea className="kds-input" rows="3" value={vendorConfig.branding?.about_text || ''} onChange={(e) => setVendorConfig({...vendorConfig, branding: {...vendorConfig.branding, about_text: e.target.value}})} style={{ minHeight: '100px', resize: 'vertical' }}></textarea>
                                        </div>

                                        <button type="submit" className="btn-primary" disabled={uploadingHero} style={{ background: '#00e676', color: '#000', fontWeight: 'bold' }}>
                                            {uploadingHero ? 'Uploading & Saving...' : 'Save Brand Identity'}
                                        </button>
                                    </form>
                                ) : (
                                    <p>Loading vendor settings...</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper Components defined outside to prevent re-renders on clock ticks
const OrderCard = ({ order, updateOrderStatus, showLocation, setIsVerifyingPin, setVerificationPin, setPinError }) => {
    const isDelivery = order.fulfillment_method === 'delivery';

    return (
        <div className="kds-card" style={order.customer_arrived ? { border: '3px solid #ef4444', animation: order.status !== 'completed' ? 'pulse 2s infinite' : 'none', position: 'relative' } : { position: 'relative' }}>
            {isDelivery && (
                <div style={{ 
                    position: 'absolute', 
                    top: '-10px', 
                    right: '-10px', 
                    background: '#3b82f6', 
                    color: '#fff', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    border: '2px solid #0f172a'
                }}>
                    🚚 DELIVERY
                </div>
            )}
            
            {order.customer_arrived && (
                <div style={{ background: '#ef4444', color: '#fff', padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', marginBottom: '-1px' }}>
                    🚨 CUSTOMER IS WAITING OUTSIDE
                </div>
            )}
            <div className="kds-card-header" style={{ paddingTop: order.customer_arrived ? '0.5rem' : '' }}>
                <h3>{order.order_number}</h3>
                <span className={`status-badge status-${order.status}`}>{order.status}</span>
            </div>
            <div className="kds-customer-info">
                <p><strong>{order.customer_name}</strong></p>
                <p>WA: {order.customer_phone}</p>
                {showLocation && <p className="kds-loc">📍 {order.locations?.name}</p>}

                {isDelivery && order.delivery_address && (
                    <div style={{ 
                        marginTop: '0.75rem', 
                        padding: '0.75rem', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        border: '1px solid rgba(59, 130, 246, 0.2)', 
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        color: '#60a5fa',
                        lineHeight: '1.4'
                    }}>
                        <strong>🏠 Delivery Address:</strong><br/>
                        {order.delivery_address}
                    </div>
                )}

                {/* PRE-ORDER TIME */}
                {order.estimated_collection_time && (
                    <p style={{ color: '#fbbf24', fontWeight: 'bold', marginTop: '0.25rem' }}>
                        ⏰ Collect time: {order.estimated_collection_time.substring(0, 5)}
                    </p>
                )}
            </div>

            <div className="kds-items">
                {order.order_items && order.order_items.map((item, idx) => (
                    <div key={idx} className="kds-item-row">
                        <span className="qty">{item.quantity}x</span>
                        <div className="item-details">
                            <span className="name">{item.menu_items?.name}</span>
                            {item.modifiers_json?.custom_notes && (
                                <span className="modifier">Note: {item.modifiers_json.custom_notes}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="kds-actions">
                {order.status === 'paid' && (
                    <button className="btn-kds btn-prep" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                        Start Preparing
                    </button>
                )}
                {order.status === 'preparing' && (
                    <button className="btn-kds btn-ready" onClick={() => updateOrderStatus(order.id, 'ready')}>
                        Mark Ready
                    </button>
                )}
                {order.status === 'ready' && (
                    <button 
                        className="btn-kds btn-complete" 
                        onClick={() => {
                            setVerificationPin('');
                            setPinError('');
                            setIsVerifyingPin(order);
                        }}
                    >
                        {isDelivery ? 'Mark Delivered' : 'Mark Collected'}
                    </button>
                )}
            </div>
        </div>
    );
};
