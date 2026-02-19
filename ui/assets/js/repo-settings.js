/**
 * Repository Settings Page Module
 */
var RepoSettings = (function() {
    var container;
    var repos = [];
    var originalRepos = [];
    var user = null;
    var currentPage = 1;
    var pageSize = 10;
    var searchQuery = '';

    function init(el) {
        container = el;
        loadRepos();
    }

    function getCurrentUser() {
        if (!user) {
            user = Auth.getUser();
        }
        return user;
    }

    function canAddRepo() {
        user = getCurrentUser();
        if (!user) return false;
        return user.role === 'owner' || user.role === 'admin';
    }

    function canEditRepo(repo) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true;
        if (user.role === 'admin') return repo.userId === user.id;
        return false;
    }

    function canDeleteRepo(repo) {
        user = getCurrentUser();
        if (!user) return false;
        if (user.role === 'owner') return true;
        if (user.role === 'admin') return repo.userId === user.id;
        return false;
    }

    function loadRepos() {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading repositories...</p></div>';

        Auth.getRepoConfigs()
            .then(function(response) {
                repos = response.repoConfigs || [];
                originalRepos = repos.slice();
                currentPage = 1;
                render();
            })
            .catch(function(err) {
                container.innerHTML = '<div class="error">Failed to load repositories: ' + err.message + '</div>';
            });
    }

    function render() {
        var canAdd = canAddRepo();

        var html = [
            '<div class="toolbar">',
            '  <div class="search-box">',
            '    <input type="text" id="repoSearch" placeholder="Search repositories..." value="' + escapeHtml(searchQuery) + '">',
            '  </div>'
        ];
        if (canAdd) {
            html.push('  <button class="btn-primary" id="addRepoBtn">Add Repository</button>');
        }
        html.push('</div>');
        html.push(
            '<table class="data-table">',
            '  <thead>',
            '    <tr>',
            '      <th>Name</th>',
            '      <th>URL</th>',
            '      <th>Branch</th>',
            '      <th>Type</th>',
            '      <th>Status</th>',
            '      <th>Actions</th>',
            '    </tr>',
            '  </thead>',
            '  <tbody id="repoList"></tbody>',
            '</table>',
            '<div id="repoPagination" class="pagination"></div>',
            '<div id="repoModal"></div>'
        );

        container.innerHTML = html.join('\n');
        renderRepoList();
        renderPagination();
        setupEventListeners();
    }

    function getFilteredRepos() {
        if (!searchQuery) {
            return originalRepos;
        }
        return originalRepos.filter(function(repo) {
            var displayName = repo.displayName || '';
            var searchStr = (repo.name + ' ' + repo.url + ' ' + displayName).toLowerCase();
            return searchStr.indexOf(searchQuery.toLowerCase()) !== -1;
        });
    }

    function renderRepoList() {
        var tbody = document.getElementById('repoList');
        var filtered = getFilteredRepos();

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No repositories found</td></tr>';
            return;
        }

        var startIndex = (currentPage - 1) * pageSize;
        var endIndex = startIndex + pageSize;
        var pageRepos = filtered.slice(startIndex, endIndex);

        tbody.innerHTML = pageRepos.map(function(repo) {
            var canEdit = canEditRepo(repo);
            var canDelete = canDeleteRepo(repo);
            var actionsHtml = '';
            if (canEdit) {
                actionsHtml += '  <button class="btn-edit" data-id="' + repo.id + '">Edit</button>';
            }
            if (canDelete) {
                actionsHtml += '  <button class="btn-delete" data-id="' + repo.id + '">Delete</button>';
            }
            if (!actionsHtml) {
                actionsHtml = '<span style="color: #888;">-</span>';
            }
            return '<tr>' +
                '<td>' + escapeHtml(repo.name) + '</td>' +
                '<td>' + escapeHtml(repo.url) + '</td>' +
                '<td>' + escapeHtml(repo.branch) + '</td>' +
                '<td>' + escapeHtml(repo.vcsType || 'git') + '</td>' +
                '<td><span class="badge ' + (repo.enabled ? 'badge-success' : 'badge-warning') + '">' + (repo.enabled ? 'Enabled' : 'Disabled') + '</span></td>' +
                '<td class="actions">' + actionsHtml + '</td>' +
                '</tr>';
        }).join('');
    }

    function renderPagination() {
        var paginationDiv = document.getElementById('repoPagination');
        var filtered = getFilteredRepos();
        var totalCount = filtered.length;
        var totalPages = Math.ceil(totalCount / pageSize);

        if (totalCount === 0) {
            paginationDiv.innerHTML = '';
            return;
        }

        var startItem = (currentPage - 1) * pageSize + 1;
        var endItem = Math.min(currentPage * pageSize, totalCount);

        var html = [
            '<div class="pagination-info">',
            '  <span>Showing ' + startItem + '-' + endItem + ' of ' + totalCount + ' items</span>',
            '</div>',
            '<div class="pagination-controls">',
            '  <label>Items per page:</label>',
            '  <select id="repoPageSize">',
            '    <option value="5"' + (pageSize === 5 ? ' selected' : '') + '>5</option>',
            '    <option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10</option>',
            '    <option value="20"' + (pageSize === 20 ? ' selected' : '') + '>20</option>',
            '    <option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50</option>',
            '    <option value="100"' + (pageSize === 100 ? ' selected' : '') + '>100</option>',
            '  </select>',
            '  <button class="btn-page" id="repoPrevPage"' + (currentPage === 1 ? ' disabled' : '') + '>Previous</button>',
            '  <span class="page-info">Page ' + currentPage + ' of ' + totalPages + '</span>',
            '  <button class="btn-page" id="repoNextPage"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next</button>',
            '</div>'
        ].join('');

        paginationDiv.innerHTML = html;
    }

    function setupEventListeners() {
        // Search input handler
        var searchInput = document.getElementById('repoSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                searchQuery = e.target.value;
                currentPage = 1;
                renderRepoList();
                renderPagination();
            });
        }

        // Add Repository button handler
        var addRepoBtn = document.getElementById('addRepoBtn');
        if (addRepoBtn) {
            addRepoBtn.addEventListener('click', function(e) {
                showRepoModal(null);
            });
        }

        // Use event delegation for pagination and action buttons
        container.addEventListener('click', function(e) {
            var target = e.target;
            var id = target.id;

            // Page size selector - use change event instead
            if (id === 'repoPageSize') {
                return;
            }

            // Previous page button
            if (id === 'repoPrevPage') {
                e.preventDefault();
                e.stopPropagation();
                if (currentPage > 1) {
                    currentPage--;
                    renderRepoList();
                    renderPagination();
                }
                return;
            }

            // Next page button
            if (id === 'repoNextPage') {
                e.preventDefault();
                e.stopPropagation();
                var filtered = getFilteredRepos();
                var totalPages = Math.ceil(filtered.length / pageSize);
                if (currentPage < totalPages) {
                    currentPage++;
                    renderRepoList();
                    renderPagination();
                }
                return;
            }

            // Edit button
            if (target && target.classList && target.classList.contains('btn-edit')) {
                e.stopPropagation();
                var repoId = parseInt(target.getAttribute('data-id'));
                var repo = originalRepos.find(function(r) { return r.id === repoId; });
                if (repo) {
                    showRepoModal(repo);
                }
                return;
            }

            // Delete button
            if (target && target.classList && target.classList.contains('btn-delete')) {
                e.stopPropagation();
                var repoId = parseInt(target.getAttribute('data-id'));
                if (confirm('Are you sure you want to delete this repository configuration?')) {
                    deleteRepo(repoId);
                }
                return;
            }
        });

        // Page size selector - use event delegation with change event
        container.addEventListener('change', function(e) {
            var target = e.target;
            if (target.id === 'repoPageSize') {
                pageSize = parseInt(target.value);
                currentPage = 1;
                renderRepoList();
                renderPagination();
            }
        });
    }

    function showRepoModal(repo) {
        var isEdit = !!repo;
        var modalHtml = [
            '<div class="modal-overlay">',
            '  <div class="modal">',
            '    <h2>' + (isEdit ? 'Edit Repository' : 'Add Repository') + '</h2>',
            '    <div id="repoFormMessage"></div>',
            '    <form id="repoForm">',
            '      <input type="hidden" name="id" value="' + (repo ? repo.id : '') + '">',
            '      <div class="form-group">',
            '        <label for="name">Name * (alphanumeric, dash, underscore)</label>',
            '        <input type="text" id="name" name="name" value="' + (repo ? escapeHtml(repo.name) : '') + '" required pattern="[a-zA-Z0-9_-]+">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="url">URL *</label>',
            '        <input type="text" id="url" name="url" value="' + (repo ? escapeHtml(repo.url) : '') + '" required placeholder="https://github.com/user/repo.git">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="displayName">Display Name</label>',
            '        <input type="text" id="displayName" name="displayName" value="' + (repo && repo.displayName ? escapeHtml(repo.displayName) : '') + '" placeholder="My Repository">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="branch">Branch</label>',
            '        <input type="text" id="branch" name="branch" value="' + (repo ? escapeHtml(repo.branch) : 'main') + '" placeholder="main">',
            '      </div>',
            '      <div class="form-group">',
            '        <label for="vcsType">VCS Type</label>',
            '        <select id="vcsType" name="vcsType">',
            '          <option value="git"' + (repo && repo.vcsType === 'git' ? ' selected' : '') + '>Git</option>',
            '          <option value="hg"' + (repo && repo.vcsType === 'hg' ? ' selected' : '') + '>Mercurial</option>',
            '          <option value="svn"' + (repo && repo.vcsType === 'svn' ? ' selected' : '') + '>Subversion</option>',
            '          <option value="bzr"' + (repo && repo.vcsType === 'bzr' ? ' selected' : '') + '>Bazaar</option>',
            '        </select>',
            '      </div>',
            '      <div class="form-group">',
            '        <div class="checkbox-group">',
            '          <input type="checkbox" id="enabled" name="enabled"' + (repo && !repo.enabled ? '' : ' checked') + '>',
            '          <label for="enabled">Enabled</label>',
            '      </div>',
            '      </div>',
            '      <div class="modal-footer">',
            '        <button type="button" class="btn-cancel" id="cancelRepoBtn">Cancel</button>',
            '        <button type="submit" class="btn-primary">' + (isEdit ? 'Update' : 'Create') + '</button>',
            '      </div>',
            '    </form>',
            '  </div>',
            '</div>'
        ].join('\n');

        var modalContainer = document.getElementById('repoModal');
        modalContainer.innerHTML = modalHtml;

        var form = document.getElementById('repoForm');
        var messageDiv = document.getElementById('repoFormMessage');

        document.getElementById('cancelRepoBtn').addEventListener('click', function() {
            modalContainer.innerHTML = '';
        });

        // Close modal when clicking outside
        modalContainer.querySelector('.modal-overlay').addEventListener('click', function(e) {
            if (e.target === this) {
                modalContainer.innerHTML = '';
            }
        });

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            // Show loading indicator
            messageDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Validating repository...</p></div>';

            var formData = {
                name: document.getElementById('name').value,
                url: document.getElementById('url').value,
                displayName: document.getElementById('displayName').value,
                branch: document.getElementById('branch').value || 'main',
                vcsType: document.getElementById('vcsType').value,
                enabled: document.getElementById('enabled').checked
            };

            var promise;
            if (isEdit) {
                promise = Auth.updateRepoConfig(repo.id, formData);
            } else {
                promise = Auth.createRepoConfig(formData);
            }

            promise
                .then(function() {
                    modalContainer.innerHTML = '';
                    loadRepos();
                    setTimeout(function() {
                        window.location.reload();
                    }, 1000);
                })
                .catch(function(err) {
                    messageDiv.innerHTML = '<div class="error">' + err.message + '</div>';
                });
        });
    }

    function deleteRepo(id) {
        Auth.deleteRepoConfig(id)
            .then(function() {
                loadRepos();
            })
            .catch(function(err) {
                alert('Failed to delete repository: ' + err.message);
            });
    }

    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init: init
    };
})();
