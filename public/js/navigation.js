// navigation.js

document.addEventListener('DOMContentLoaded', function() {
    function updateSelectedMode(path) {
        const menuItems = document.querySelectorAll('.nav-item');
        menuItems.forEach(item => {
            const underline = item.querySelector('div:last-child');
            if (item.getAttribute('hx-get') === path) {
                underline.classList.remove('scale-x-0');
                underline.classList.add('scale-x-100');
                item.classList.add('text-red-400');
            } else {
                underline.classList.remove('scale-x-100');
                underline.classList.add('scale-x-0');
                item.classList.remove('text-red-400');
            }
        });
    }

    function initializeNavBar() {
        const currentPath = window.location.pathname;
        updateSelectedMode(currentPath);
    }

    // Initialize on page load
    initializeNavBar();

    // Update on HTMX after-settle event
    document.body.addEventListener('htmx:afterSettle', function(event) {
        const currentPath = window.location.pathname;
        updateSelectedMode(currentPath);
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const mobileMenu = document.getElementById('mobile-extra-options');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const navigation = document.querySelector('nav');
        const modalContainer = document.getElementById('modal-container');
        
        // Check if mobile menu is open and no modals are open
        if (mobileMenu.classList.contains('mobile-menu-open') && 
            (!modalContainer || !modalContainer.querySelector('#modal-overlay'))) {
          
            // Check if the click is outside the navigation area
            if (!navigation.contains(event.target) && event.target !== mobileMenuButton) {
                mobileMenu.classList.remove('mobile-menu-open');
                document.body.classList.remove('menu-open');
            }
        }
    });

    // Existing mobile menu toggle functionality
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileExtraOptions = document.getElementById('mobile-extra-options');

    function toggleMobileMenu() {
        mobileExtraOptions.classList.toggle('mobile-menu-open');
        document.body.classList.toggle('menu-open');
    }

    mobileMenuButton.addEventListener('click', toggleMobileMenu);

    // Close mobile menu on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            mobileExtraOptions.classList.remove('mobile-menu-open');
            document.body.classList.remove('menu-open');
        }
    });

    function initializeTooltips() {
        const tooltipTriggerList = document.querySelectorAll('[data-tooltip]');
        tooltipTriggerList.forEach(triggerEl => {
            const tooltipText = triggerEl.getAttribute('data-tooltip');
            const tooltipEl = document.createElement('div');
            tooltipEl.textContent = tooltipText;
            tooltipEl.className = 'absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm transition-opacity duration-300 tooltip dark:bg-gray-700 invisible opacity-0';
            document.body.appendChild(tooltipEl);

            function positionTooltip() {
                const triggerRect = triggerEl.getBoundingClientRect();
                const tooltipRect = tooltipEl.getBoundingClientRect();
                
                const top = triggerRect.bottom + window.scrollY + 10; // 10px below the button
                const left = triggerRect.left + window.scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2);

                tooltipEl.style.top = `${top}px`;
                tooltipEl.style.left = `${left}px`;
            }

            triggerEl.addEventListener('mouseenter', () => {
                tooltipEl.classList.remove('invisible');
                positionTooltip();
                setTimeout(() => tooltipEl.classList.remove('opacity-0'), 10);
            });

            triggerEl.addEventListener('mouseleave', () => {
                tooltipEl.classList.add('opacity-0');
                setTimeout(() => tooltipEl.classList.add('invisible'), 300);
            });

            // Reposition tooltip on window resize
            window.addEventListener('resize', positionTooltip);
        });
    }

    // Initialize tooltips
    initializeTooltips();
});
