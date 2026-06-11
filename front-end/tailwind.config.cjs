const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx}',
        './components/**/*.{js,ts,jsx,tsx}',
        './pages/**/*.{js,ts,jsx,tsx}'
    ],
    darkMode: 'media',
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                'primary-foreground': 'var(--color-primary-foreground)',
                secondary: 'var(--color-secondary)',
                'secondary-foreground': 'var(--color-secondary-foreground)',
                /* aliases for existing classes like bg-color-primary used in components */
                'color-primary': 'var(--color-primary)',
                'color-primary-foreground': 'var(--color-primary-foreground)',
                'color-secondary': 'var(--color-secondary)',
                'color-secondary-foreground': 'var(--color-secondary-foreground)',
            },
            fontFamily: {
                sans: ['Inter', ...defaultTheme.fontFamily.sans]
            }
        }
    },
    plugins: [
        function ({ addBase, theme }) {
            addBase({
                ':root': {
                    '--background': theme('colors.white'),
                    '--foreground': theme('colors.gray.900'),

                    '--color-primary': theme('colors.fuchsia.600'),
                    '--color-primary-foreground': theme('colors.white'),

                    '--color-secondary': theme('colors.gray.600'),
                    '--color-secondary-foreground': theme('colors.white')
                },
                '@media (prefers-color-scheme: dark)': {
                    ':root': {
                        '--background': theme('colors.gray.900'),
                        '--foreground': theme('colors.gray.100'),

                        '--color-primary': theme('colors.blue.400'),
                        '--color-secondary': theme('colors.gray.400')
                    }
                }
            });
        }
    ]
};
