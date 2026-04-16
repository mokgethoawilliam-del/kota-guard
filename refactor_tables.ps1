$files = Get-ChildItem -Path components/*.jsx -Recurse
foreach ($file in $files) {
    (Get-Content $file.FullName) | ForEach-Object {
        $_ -replace "\.from\('vendors'\)", ".from('kg_vendors')" `
           -replace "\.from\('locations'\)", ".from('kg_locations')" `
           -replace "\.from\('ingredients'\)", ".from('kg_ingredients')" `
           -replace "\.from\('menu_items'\)", ".from('kg_menu_items')" `
           -replace "\.from\('orders'\)", ".from('kg_orders')" `
           -replace "\.from\('order_items'\)", ".from('kg_order_items')" `
           -replace "\.from\('expenses'\)", ".from('kg_expenses')" `
           -replace "\.from\('support_chats'\)", ".from('kg_support_chats')" `
           -replace "\.from\('testimonials'\)", ".from('kg_testimonials')" `
           -replace "\.from\('site_gallery'\)", ".from('kg_site_gallery')" `
           -replace "\.from\('profiles'\)", ".from('kg_profiles')" `
           -replace "table: 'orders'", "table: 'kg_orders'" `
           -replace "table: 'support_chats'", "table: 'kg_support_chats'" `
           -replace "channel\('public:orders'\)", "channel('public:kg_orders')" `
           -replace "channel\('public:support_chats'\)", "channel('public:kg_support_chats')"
    } | Set-Content $file.FullName
}
