(function () {
    var root = document.documentElement
    var saved = window.localStorage.getItem('theme')
    var toggle = document.getElementById('theme-toggle')

    if (saved === 'light' || saved === 'dark') {
        root.setAttribute('data-theme', saved)
    }

    if (!toggle) {
        return
    }

    toggle.addEventListener('click', function () {
        var current = root.getAttribute('data-theme')
        var next

        if (current === 'dark') {
            next = 'light'
        } else if (current === 'light') {
            next = 'dark'
        } else {
            next = window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'light'
                : 'dark'
        }

        root.setAttribute('data-theme', next)
        window.localStorage.setItem('theme', next)
    })
})()
