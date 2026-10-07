// Oncotics: no service worker is used. Unregister any left over from older deployments.
if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function (r) { r.forEach(function (x) { x.unregister(); }); }); }
