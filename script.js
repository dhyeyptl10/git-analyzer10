// ==================== DATA STRUCTURES ====================

/**
 * GitHubProfile - Main data structure for user profile
 */
class GitHubProfile {
    constructor(data) {
        this.username = data.login;
        this.name = data.name || data.login;
        this.bio = data.bio || '';
        this.publicRepos = data.public_repos;
        this.followers = data.followers;
        this.following = data.following;
        this.createdAt = new Date(data.created_at);
        this.updatedAt = new Date(data.updated_at);
        this.avatarUrl = data.avatar_url;
        this.htmlUrl = data.html_url;
    }
}

/**
 * Repository - Data structure for repository analysis
 */
class Repository {
    constructor(data) {
        this.name = data.name;
        this.fullName = data.full_name;
        this.description = data.description || 'No description provided';
        this.language = data.language || 'Not specified';
        this.stars = data.stargazers_count;
        this.forks = data.forks_count;
        this.watchers = data.watchers_count;
        this.size = data.size;
        this.createdAt = new Date(data.created_at);
        this.updatedAt = new Date(data.updated_at);
        this.pushedAt = new Date(data.pushed_at);
        this.hasReadme = false;
        this.readmeQuality = 0;
        this.codeQuality = 0;
        this.htmlUrl = data.html_url;
        this.topics = data.topics || [];
    }
}

/**
 * PortfolioScore - Comprehensive scoring system
 */
class PortfolioScore {
    constructor() {
        this.documentation = 0;      // /20
        this.codeQuality = 0;         // /25
        this.activity = 0;            // /20
        this.impact = 0;              // /20
        this.organization = 0;        // /15
        this.overall = 0;             // /100
        this.rating = '';
        this.breakdown = {
            documentation: {},
            codeQuality: {},
            activity: {},
            impact: {},
            organization: {}
        };
    }

    calculateOverall() {
        this.overall = Math.round(
            this.documentation +
            this.codeQuality +
            this.activity +
            this.impact +
            this.organization
        );
        this.rating = this.getRating();
    }

    getRating() {
        if (this.overall >= 85) return 'Excellent';
        if (this.overall >= 70) return 'Good';
        if (this.overall >= 50) return 'Average';
        return 'Needs Improvement';
    }
}

/**
 * Recommendation - Actionable improvement suggestions
 */
class Recommendation {
    constructor(title, description, priority, category) {
        this.title = title;
        this.description = description;
        this.priority = priority; // 'high', 'medium', 'low'
        this.category = category; // 'documentation', 'code', 'activity', etc.
    }
}

/**
 * AnalysisResult - Complete analysis output
 */
class AnalysisResult {
    constructor() {
        this.profile = null;
        this.repositories = [];
        this.score = new PortfolioScore();
        this.recommendations = [];
        this.skills = new Map();
        this.analyzedAt = new Date();
    }
}

// ==================== GITHUB API SERVICE ====================

// class GitHubService {
//     constructor() {
//         this.baseUrl = 'https://api.github.com';
//         this.headers = {
//             'Accept': 'application/vnd.github.v3+json'
//         };
//     }

class GitHubService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.headers = {
            'Accept': 'application/vnd.github.v3+json',
            
            //  GITHUB_TOKEN=your_token;

        };
    }
    

    extractUsername(input) {
        input = input.trim();
        
        // If it's a full GitHub URL
        const urlMatch = input.match(/github\.com\/([a-zA-Z0-9-]+)/);
        if (urlMatch) {
            return urlMatch[1];
        }
        
        // Otherwise assume it's just a username
        return input.replace(/^@/, '');
    }

    async fetchProfile(username) {
        const response = await fetch(`${this.baseUrl}/users/${username}`, {
            headers: this.headers
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch profile: ${response.status}`);
        }
        
        const data = await response.json();
        return new GitHubProfile(data);
    }

    async fetchRepositories(username) {
        const response = await fetch(
            `${this.baseUrl}/users/${username}/repos?sort=updated&per_page=100`,
            { headers: this.headers }
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch repositories: ${response.status}`);
        }
        
        const data = await response.json();
        return data.map(repo => new Repository(repo));
    }

    async fetchReadme(fullName) {
        try {
            const response = await fetch(
                `${this.baseUrl}/repos/${fullName}/readme`,
                { headers: this.headers }
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            const content = atob(data.content);
            return content;
        } catch (error) {
            return null;
        }
    }

    async fetchLanguages(fullName) {
        try {
            const response = await fetch(
                `${this.baseUrl}/repos/${fullName}/languages`,
                { headers: this.headers }
            );
            
            if (!response.ok) return {};
            
            return await response.json();
        } catch (error) {
            return {};
        }
    }
}

// ==================== ANALYZER ENGINE ====================

class PortfolioAnalyzer {
    constructor() {
        this.githubService = new GitHubService();
    }

    async analyze(username) {
        const result = new AnalysisResult();
        
        try {
            // Fetch profile
            result.profile = await this.githubService.fetchProfile(username);
            
            // Fetch repositories
            result.repositories = await this.githubService.fetchRepositories(username);
            
            // Filter out forks for main analysis
            const originalRepos = result.repositories.filter(repo => !repo.name.includes('fork'));
            
            // Analyze README quality for top repositories
            await this.analyzeReadmeQuality(originalRepos.slice(0, 10));
            
            // Calculate scores
            this.calculateDocumentationScore(result, originalRepos);
            this.calculateCodeQualityScore(result, originalRepos);
            this.calculateActivityScore(result, originalRepos);
            this.calculateImpactScore(result, originalRepos);
            this.calculateOrganizationScore(result, originalRepos);
            
            // Calculate overall score
            result.score.calculateOverall();
            
            // Extract skills
            this.extractSkills(result, originalRepos);
            
            // Generate recommendations
            this.generateRecommendations(result, originalRepos);
            
            return result;
            
        } catch (error) {
            console.error('Analysis error:', error);
            throw error;
        }
    }

    async analyzeReadmeQuality(repositories) {
        for (const repo of repositories) {
            const readme = await this.githubService.fetchReadme(repo.fullName);
            
            if (!readme) {
                repo.hasReadme = false;
                repo.readmeQuality = 0;
                continue;
            }
            
            repo.hasReadme = true;
            repo.readmeQuality = this.scoreReadme(readme);
        }
    }

    scoreReadme(content) {
        let score = 0;
        const lower = content.toLowerCase();
        
        // Basic presence (2 points)
        if (content.length > 100) score += 2;
        
        // Has title/heading (1 point)
        if (content.match(/^#\s+/m)) score += 1;
        
        // Has description (1 point)
        if (content.length > 300) score += 1;
        
        // Installation instructions (1 point)
        if (lower.includes('install') || lower.includes('setup')) score += 1;
        
        // Usage examples (1 point)
        if (lower.includes('usage') || lower.includes('example')) score += 1;
        
        // Code blocks (1 point)
        if (content.includes('```')) score += 1;
        
        // Images/screenshots (1 point)
        if (content.includes('![')) score += 1;
        
        // License (1 point)
        if (lower.includes('license')) score += 1;
        
        return Math.min(score, 10);
    }

    calculateDocumentationScore(result, repos) {
        const reposWithReadme = repos.filter(r => r.hasReadme).length;
        const totalRepos = repos.length || 1;
        const avgReadmeQuality = repos.reduce((sum, r) => sum + r.readmeQuality, 0) / totalRepos;
        
        // README presence (0-10 points)
        const presenceScore = (reposWithReadme / totalRepos) * 10;
        
        // README quality (0-10 points)
        const qualityScore = avgReadmeQuality;
        
        result.score.documentation = Math.round(presenceScore + qualityScore);
        result.score.breakdown.documentation = {
            presence: Math.round(presenceScore),
            quality: Math.round(qualityScore),
            reposWithReadme,
            totalRepos
        };
    }

    calculateCodeQualityScore(result, repos) {
        let score = 0;
        
        // Language diversity (0-8 points)
        const languages = new Set();
        repos.forEach(repo => {
            if (repo.language) languages.add(repo.language);
        });
        const diversityScore = Math.min(languages.size * 2, 8);
        score += diversityScore;
        
        // Repository structure (0-7 points)
        const wellStructured = repos.filter(r => 
            r.topics.length > 0 || r.description.length > 20
        ).length;
        const structureScore = (wellStructured / repos.length) * 7;
        score += structureScore;
        
        // Average repository size (0-5 points)
        const avgSize = repos.reduce((sum, r) => sum + r.size, 0) / repos.length;
        const sizeScore = avgSize > 100 ? 5 : avgSize > 50 ? 3 : 1;
        score += sizeScore;
        
        // Code recency (0-5 points)
        const recentRepos = repos.filter(r => {
            const daysSinceUpdate = (Date.now() - r.pushedAt) / (1000 * 60 * 60 * 24);
            return daysSinceUpdate < 90;
        }).length;
        const recencyScore = (recentRepos / repos.length) * 5;
        score += recencyScore;
        
        result.score.codeQuality = Math.round(score);
        result.score.breakdown.codeQuality = {
            diversity: Math.round(diversityScore),
            structure: Math.round(structureScore),
            size: Math.round(sizeScore),
            recency: Math.round(recencyScore)
        };
    }

    calculateActivityScore(result, repos) {
        let score = 0;
        
        // Account age (0-5 points)
        const accountAgeDays = (Date.now() - result.profile.createdAt) / (1000 * 60 * 60 * 24);
        const ageScore = accountAgeDays > 365 ? 5 : accountAgeDays > 180 ? 3 : 1;
        score += ageScore;
        
        // Repository count (0-5 points)
        const repoScore = Math.min(result.profile.publicRepos / 5, 5);
        score += repoScore;
        
        // Recent activity (0-10 points)
        const recentActivity = repos.filter(r => {
            const daysSinceUpdate = (Date.now() - r.pushedAt) / (1000 * 60 * 60 * 24);
            return daysSinceUpdate < 30;
        }).length;
        const activityScore = Math.min((recentActivity / 3) * 10, 10);
        score += activityScore;
        
        result.score.activity = Math.round(score);
        result.score.breakdown.activity = {
            age: Math.round(ageScore),
            repoCount: Math.round(repoScore),
            recency: Math.round(activityScore)
        };
    }

    calculateImpactScore(result, repos) {
        let score = 0;
        
        // Total stars (0-8 points)
        const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
        const starScore = Math.min(totalStars / 5, 8);
        score += starScore;
        
        // Followers (0-6 points)
        const followerScore = Math.min(result.profile.followers / 10, 6);
        score += followerScore;
        
        // Project complexity (0-6 points)
        const complexProjects = repos.filter(r => 
            r.stars > 5 || r.forks > 2 || r.size > 1000
        ).length;
        const complexityScore = Math.min((complexProjects / 3) * 6, 6);
        score += complexityScore;
        
        result.score.impact = Math.round(score);
        result.score.breakdown.impact = {
            stars: Math.round(starScore),
            followers: Math.round(followerScore),
            complexity: Math.round(complexityScore)
        };
    }

    calculateOrganizationScore(result, repos) {
        let score = 0;
        
        // Pinned repositories bonus (0-5 points)
        // We'll give points for having descriptions and topics
        const organizedRepos = repos.filter(r => 
            r.description && r.description.length > 20
        ).length;
        const descScore = (organizedRepos / repos.length) * 5;
        score += descScore;
        
        // Topic usage (0-5 points)
        const reposWithTopics = repos.filter(r => r.topics.length > 0).length;
        const topicScore = (reposWithTopics / repos.length) * 5;
        score += topicScore;
        
        // Naming conventions (0-5 points)
        const wellNamed = repos.filter(r => 
            !r.name.includes('test') && 
            !r.name.includes('temp') &&
            r.name.length > 3
        ).length;
        const nameScore = (wellNamed / repos.length) * 5;
        score += nameScore;
        
        result.score.organization = Math.round(score);
        result.score.breakdown.organization = {
            descriptions: Math.round(descScore),
            topics: Math.round(topicScore),
            naming: Math.round(nameScore)
        };
    }

    extractSkills(result, repos) {
        const languageStats = {};
        
        repos.forEach(repo => {
            if (repo.language) {
                if (!languageStats[repo.language]) {
                    languageStats[repo.language] = 0;
                }
                languageStats[repo.language]++;
            }
        });
        
        // Convert to sorted array
        const sortedSkills = Object.entries(languageStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        const total = repos.length;
        sortedSkills.forEach(([language, count]) => {
            const percentage = Math.round((count / total) * 100);
            result.skills.set(language, percentage);
        });
    }

    generateRecommendations(result, repos) {
        const recs = [];
        
        // Documentation recommendations
        if (result.score.documentation < 15) {
            const reposWithoutReadme = repos.filter(r => !r.hasReadme);
            if (reposWithoutReadme.length > 0) {
                recs.push(new Recommendation(
                    'Add README Files',
                    `${reposWithoutReadme.length} repositories are missing README files. Start with your most popular repos and add clear documentation including purpose, installation, and usage instructions.`,
                    'high',
                    'documentation'
                ));
            }
        }
        
        if (result.score.breakdown.documentation.quality < 7) {
            recs.push(new Recommendation(
                'Enhance README Quality',
                'Improve your README files by adding code examples, screenshots, installation guides, and contribution guidelines. High-quality documentation shows professionalism.',
                'medium',
                'documentation'
            ));
        }
        
        // Code quality recommendations
        if (result.score.codeQuality < 18) {
            recs.push(new Recommendation(
                'Diversify Technology Stack',
                'Learn and showcase projects in different programming languages and frameworks. This demonstrates versatility and adaptability to recruiters.',
                'medium',
                'code'
            ));
        }
        
        const reposWithoutDesc = repos.filter(r => !r.description || r.description.length < 20);
        if (reposWithoutDesc.length > 0) {
            recs.push(new Recommendation(
                'Add Repository Descriptions',
                `${reposWithoutDesc.length} repositories lack meaningful descriptions. Add clear, concise descriptions that explain what each project does and the problems it solves.`,
                'high',
                'organization'
            ));
        }
        
        // Activity recommendations
        if (result.score.activity < 15) {
            recs.push(new Recommendation(
                'Increase Commit Consistency',
                'Aim for regular contributions. Even small, consistent updates (2-3 times per week) signal active learning and dedication to recruiters.',
                'high',
                'activity'
            ));
        }
        
        const oldRepos = repos.filter(r => {
            const daysSinceUpdate = (Date.now() - r.pushedAt) / (1000 * 60 * 60 * 24);
            return daysSinceUpdate > 180;
        });
        
        if (oldRepos.length > 3) {
            recs.push(new Recommendation(
                'Update Stale Repositories',
                `${oldRepos.length} repositories haven't been updated in over 6 months. Archive old projects or add recent commits to show active maintenance.`,
                'medium',
                'activity'
            ));
        }
        
        // Impact recommendations
        if (result.score.impact < 15) {
            recs.push(new Recommendation(
                'Build Showcase Projects',
                'Create 2-3 substantial projects that solve real problems. Quality trumps quantity - focus on projects that demonstrate technical depth and practical application.',
                'high',
                'impact'
            ));
        }
        
        if (result.profile.followers < 10) {
            recs.push(new Recommendation(
                'Build Your Network',
                'Engage with the developer community by contributing to open source, following interesting developers, and sharing your work. A strong network increases visibility.',
                'low',
                'impact'
            ));
        }
        
        // Organization recommendations
        const reposWithoutTopics = repos.filter(r => r.topics.length === 0);
        if (reposWithoutTopics.length > 0) {
            recs.push(new Recommendation(
                'Add Repository Topics',
                `${reposWithoutTopics.length} repositories lack topic tags. Add relevant topics to improve discoverability and show technical areas of expertise.`,
                'medium',
                'organization'
            ));
        }
        
        result.recommendations = recs;
    }
}

// ==================== UI CONTROLLER ====================

class UIController {
    constructor() {
        this.analyzer = new PortfolioAnalyzer();
        this.initializeElements();
        this.attachEventListeners();
        this.initializeAnimations();
    }

    initializeElements() {
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.githubInput = document.getElementById('githubUrl');
        this.loadingState = document.getElementById('loadingState');
        this.resultsSection = document.getElementById('resultsSection');
    }

    attachEventListeners() {
        this.analyzeBtn.addEventListener('click', () => this.handleAnalyze());
        this.githubInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAnalyze();
        });
    }

    async handleAnalyze() {
        const input = this.githubInput.value.trim();
        
        if (!input) {
            alert('Please enter a GitHub username or URL');
            return;
        }
        
        try {
            const username = this.analyzer.githubService.extractUsername(input);
            
            // Show loading
            this.showLoading();
            
            // Animate loading steps
            this.animateLoadingSteps();
            
            // Perform analysis
            const result = await this.analyzer.analyze(username);
            
            // Hide loading
            setTimeout(() => {
                this.hideLoading();
                this.displayResults(result);
            }, 1500);
            
        } catch (error) {
            this.hideLoading();
            alert(`Error: ${error.message}. Please check the username and try again.`);
        }
    }

    showLoading() {
        this.analyzeBtn.classList.add('loading');
        this.loadingState.classList.add('active');
        this.resultsSection.classList.remove('active');
    }

    hideLoading() {
        this.analyzeBtn.classList.remove('loading');
        this.loadingState.classList.remove('active');
    }

    animateLoadingSteps() {
        const steps = document.querySelectorAll('.loading-step');
        steps.forEach((step, index) => {
            setTimeout(() => {
                steps.forEach(s => s.classList.remove('active'));
                step.classList.add('active');
                
                const icon = step.querySelector('.step-icon');
                if (index === steps.length - 1) {
                    icon.textContent = '✓';
                } else {
                    icon.textContent = '⟳';
                }
                
                if (index > 0) {
                    steps[index - 1].querySelector('.step-icon').textContent = '✓';
                }
            }, index * 500);
        });
    }

    displayResults(result) {
        // Show results section
        this.resultsSection.classList.add('active');
        
        // Update score
        this.updateScore(result.score);
        
        // Update metrics
        this.updateMetrics(result.score);
        
        // Update profile stats
        this.updateProfileStats(result);
        
        // Update skills
        this.updateSkills(result.skills);
        
        // Update recommendations
        this.updateRecommendations(result.recommendations);
        
        // Update repositories
        this.updateRepositories(result.repositories.slice(0, 10));
        
        // Scroll to results
        setTimeout(() => {
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }

    updateScore(score) {
        const scoreNumber = document.getElementById('overallScore');
        const scoreCircle = document.getElementById('scoreCircle');
        const scoreRating = document.getElementById('scoreRating');
        const scoreDate = document.querySelector('.score-date');
        
        // Animate score number
        this.animateNumber(scoreNumber, 0, score.overall, 2000);
        
        // Animate circle
        const circumference = 534;
        const offset = circumference - (score.overall / 100) * circumference;
        
        setTimeout(() => {
            scoreCircle.style.strokeDashoffset = offset;
        }, 100);
        
        // Update rating
        scoreRating.textContent = score.rating;
        scoreRating.className = 'rating-badge ' + score.rating.toLowerCase().replace(' ', '-');
        
        // Update date
        scoreDate.textContent = `Analyzed on ${new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        })}`;
    }

    updateMetrics(score) {
        const metrics = [
            { id: 'doc', value: score.documentation, max: 20 },
            { id: 'code', value: score.codeQuality, max: 25 },
            { id: 'activity', value: score.activity, max: 20 },
            { id: 'impact', value: score.impact, max: 20 },
            { id: 'org', value: score.organization, max: 15 }
        ];
        
        metrics.forEach(metric => {
            const scoreEl = document.getElementById(`${metric.id}Score`);
            const barEl = document.getElementById(`${metric.id}Bar`);
            
            this.animateNumber(scoreEl, 0, metric.value, 1500);
            
            setTimeout(() => {
                barEl.style.setProperty('--score', metric.value);
            }, 200);
        });
    }

    updateProfileStats(result) {
        document.getElementById('repoCount').textContent = result.profile.publicRepos;
        
        const totalStars = result.repositories.reduce((sum, r) => sum + r.stars, 0);
        document.getElementById('starCount').textContent = totalStars;
        
        document.getElementById('followerCount').textContent = result.profile.followers;
        document.getElementById('langCount').textContent = result.skills.size;
        
        // Animate numbers
        const statValues = document.querySelectorAll('.stat-box .stat-value');
        statValues.forEach(el => {
            const target = parseInt(el.textContent);
            this.animateNumber(el, 0, target, 1000);
        });
    }

    updateSkills(skills) {
        const skillsList = document.getElementById('skillsList');
        skillsList.innerHTML = '';
        
        skills.forEach((percentage, language) => {
            const badge = document.createElement('div');
            badge.className = 'skill-badge';
            badge.innerHTML = `
                <span>${language}</span>
                <span class="skill-percentage">${percentage}%</span>
            `;
            skillsList.appendChild(badge);
            
            // Animate entrance
            gsap.from(badge, {
                opacity: 0,
                y: 20,
                duration: 0.5,
                delay: Array.from(skills.keys()).indexOf(language) * 0.1
            });
        });
    }

    updateRecommendations(recommendations) {
        const recList = document.getElementById('recommendationsList');
        recList.innerHTML = '';
        
        recommendations.forEach((rec, index) => {
            const item = document.createElement('div');
            item.className = `recommendation-item priority-${rec.priority}`;
            item.innerHTML = `
                <div class="recommendation-header">
                    <h4 class="recommendation-title">${rec.title}</h4>
                    <span class="priority-badge ${rec.priority}">${rec.priority}</span>
                </div>
                <p class="recommendation-description">${rec.description}</p>
            `;
            recList.appendChild(item);
            
            // Animate entrance
            gsap.from(item, {
                opacity: 0,
                x: -30,
                duration: 0.6,
                delay: index * 0.1
            });
        });
    }

    updateRepositories(repositories) {
        const repoList = document.getElementById('repoList');
        repoList.innerHTML = '';
        
        repositories.forEach((repo, index) => {
            const item = document.createElement('div');
            item.className = 'repo-item';
            
            let readmeStatus = 'missing';
            let readmeText = 'No README';
            
            if (repo.hasReadme) {
                if (repo.readmeQuality >= 7) {
                    readmeStatus = 'complete';
                    readmeText = 'Excellent README';
                } else if (repo.readmeQuality >= 4) {
                    readmeStatus = 'partial';
                    readmeText = 'Basic README';
                } else {
                    readmeStatus = 'partial';
                    readmeText = 'Needs Improvement';
                }
            }
            
            item.innerHTML = `
                <div class="repo-header">
                    <a href="${repo.htmlUrl}" target="_blank" class="repo-name">${repo.name}</a>
                    <div class="repo-stars">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0L10 6L16 6L11 10L13 16L8 12L3 16L5 10L0 6L6 6L8 0Z"/>
                        </svg>
                        ${repo.stars}
                    </div>
                </div>
                <p class="repo-description">${repo.description}</p>
                <div class="repo-meta">
                    ${repo.language ? `
                        <div class="repo-language">
                            <span class="language-dot"></span>
                            <span>${repo.language}</span>
                        </div>
                    ` : ''}
                    <div class="repo-updated">
                        Updated ${this.getTimeAgo(repo.updatedAt)}
                    </div>
                    <span class="readme-status ${readmeStatus}">${readmeText}</span>
                </div>
            `;
            repoList.appendChild(item);
            
            // Animate entrance
            gsap.from(item, {
                opacity: 0,
                y: 20,
                duration: 0.5,
                delay: index * 0.08
            });
        });
    }

    animateNumber(element, start, end, duration) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                element.textContent = Math.round(end);
                clearInterval(timer);
            } else {
                element.textContent = Math.round(current);
            }
        }, 16);
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        
        return 'just now';
    }

    initializeAnimations() {
        gsap.registerPlugin(ScrollTrigger);

        // 1. Entrance Animation (Runs immediately when page loads)
        const tl = gsap.timeline();
        tl.from(".navbar", { y: -100, opacity: 0, duration: 1, ease: "power4.out" })
          .from(".title-line", { 
              y: 50, 
              opacity: 0, 
              stagger: 0.2, 
              duration: 1, 
              ease: "power3.out" 
          }, "-=0.5")
          .from(".hero-visual", { 
              scale: 0.8, 
              opacity: 0, 
              duration: 1.2, 
              ease: "elastic.out(1, 0.5)" 
          }, "-=0.8");

        // 2. Scroll Fix (Ensures items don't stay invisible)
        const fadeElements = document.querySelectorAll('.feature-card, .step, .metric-card, .analyzer-container');
        
        fadeElements.forEach((el) => {
            gsap.from(el, {
                scrollTrigger: {
                    trigger: el,
                    start: 'top 90%',
                    toggleActions: 'play none none none' 
                },
                opacity: 0,
                y: 30,
                duration: 0.8,
                clearProps: "all" // This prevents the 'blurry' or 'stuck' look
            });
        });
    }

initializeAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // 1. HERO FLOATING CARDS DISAPPEARING EFFECT
    // Ye un cards ko pakdega jo dhire-dhire screen ke bich mein aate hain
    const floatingCards = document.querySelectorAll('.floating-card');
    
    floatingCards.forEach((card) => {
        gsap.to(card, {
            scrollTrigger: {
                trigger: ".hero",
                start: "top top",      // Jaise hi scroll shuru ho
                end: "bottom center",  // Center tak pahunchne se pehle gayab
                scrub: 1,              // Smooth transition
            },
            x: -200,                  // Left ki taraf move hote hue gayab honge
            scale: 0.4,               // Chota ho jayega
            opacity: 0,               // Gayab
            filter: "blur(20px)",     // Ekdum kadak blur effect
            ease: "power2.in"
        });
    });

    // 2. ENTRY ANIMATION (For Hero Section)
    gsap.from(".hero-visual", {
        opacity: 0,
        x: 100,
        duration: 1.5,
        ease: "power4.out"
    });
}
    





    
 


}

// ==================== INITIALIZE APP ====================

document.addEventListener('DOMContentLoaded', () => {
    new UIController();
    
    // Add SVG gradient for score circle
    const svg = document.querySelector('.score-svg');
    if (svg) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'scoreGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');
        
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('style', 'stop-color:#667eea');
        
        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('style', 'stop-color:#764ba2');
        
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
    }
});
