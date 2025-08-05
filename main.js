// Portfolio Interactive Features

// 1. Smooth scrolling for navigation
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling to anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});

// 2. Typing animation for the main heading
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

// Apply typing effect to the main heading
window.addEventListener('load', function() {
    const heading = document.querySelector('h1');
    if (heading) {
        const originalText = heading.textContent;
        typeWriter(heading, originalText, 80);
    }
});

// 3. Project cards hover effects and modal functionality with GitHub README
document.addEventListener('DOMContentLoaded', function() {
    const projects = document.querySelectorAll('.project');
    const modal = document.getElementById('project-modal');
    const closeModal = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalLoading = document.getElementById('modal-loading');
    const modalReadme = document.getElementById('modal-readme');
    const modalLinks = document.getElementById('modal-links');
    
    // Function to fetch README from GitHub
    async function fetchGitHubReadme(username, repo) {
        try {
            const response = await fetch(`https://api.github.com/repos/${username}/${repo}/readme`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const content = atob(data.content); // Decode base64
            return content;
        } catch (error) {
            console.error('Error fetching README:', error);
            return `# ${repo}\n\nError loading README from GitHub. Please visit the repository directly to view project details.\n\n**Error:** ${error.message}`;
        }
    }
    
    projects.forEach(project => {
        // Hover effects
        project.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.transition = 'transform 0.3s ease';
            this.style.cursor = 'pointer';
        });
        
        project.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });

        // Modal functionality with GitHub README
        project.addEventListener('click', async function(e) {
            // Prevent link clicks from triggering modal
            if (e.target.tagName === 'A') return;
            
            if (!modal) return;
            
            const title = project.getAttribute('data-title') || project.querySelector('h3').textContent;
            const githubUser = project.getAttribute('data-github-user');
            const githubRepo = project.getAttribute('data-github-repo');
            const links = project.getAttribute('data-links') || '';
            
            // Set title and show modal immediately
            modalTitle.textContent = title;
            modalLinks.innerHTML = links;
            
            // Show loading state
            modalLoading.style.display = 'block';
            modalReadme.style.display = 'none';
            modal.classList.add('show');
            
            // Fetch and display README
            if (githubUser && githubRepo) {
                const readmeContent = await fetchGitHubReadme(githubUser, githubRepo);
                
                // Hide loading and show content
                modalLoading.style.display = 'none';
                modalReadme.style.display = 'block';
                
                // Parse markdown and display
                if (typeof marked !== 'undefined') {
                    modalReadme.innerHTML = marked.parse(readmeContent);
                } else {
                    // Fallback if marked.js fails to load
                    modalReadme.innerHTML = `<pre>${readmeContent}</pre>`;
                }
            } else {
                // No GitHub info available
                modalLoading.style.display = 'none';
                modalReadme.style.display = 'block';
                modalReadme.innerHTML = '<p>No README information available for this project.</p>';
            }
        });
    });

    // Close modal functionality
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            modal.classList.remove('show');
        });
    }
    
    // Close modal when clicking outside content
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
});

// 4. Dynamic greeting based on time of day
function updateGreeting() {
    const greeting = document.querySelector('.tagline');
    if (greeting) {
        const hour = new Date().getHours();
        let message;
        
        if (hour < 12) {
            message = "Good morning! Welcome to my corner of the internet ☀️";
        } else if (hour < 18) {
            message = "Good afternoon! Welcome to my corner of the internet ☀️";
        } else {
            message = "Good evening! Welcome to my corner of the internet ☀️";
        }
        
        greeting.textContent = message;
    }
}

// Update greeting when page loads
window.addEventListener('load', updateGreeting);

// 5. Simple contact form validation (if you add a contact form later)
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// 6. Theme toggle functionality - floating sun/moon button
function createThemeToggle() {
    const toggle = document.createElement('button');
    toggle.textContent = '🌙';
    toggle.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        border: none;
        background: #8fc28f;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        z-index: 999;
    `;
    
    toggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        this.textContent = document.body.classList.contains('dark-theme') ? '☀️' : '🌙';
    });
    
    document.body.appendChild(toggle);
}

// Add theme toggle when page loads
window.addEventListener('load', createThemeToggle);

// 7. Intersection Observer for fade-in animations
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('section');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }

        });
    }, observerOptions);
    
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
});

// 8. Console easter egg for fellow developers
console.log(`
🎮 Hey there, fellow developer! 
👾 Thanks for checking out my portfolio!
✨ Feel free to reach out if you want to collaborate on some cool hardware projects!
`);