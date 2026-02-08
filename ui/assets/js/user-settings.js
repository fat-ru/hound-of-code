var UserSettings = (function() {
    var container;
    var users = [];

    function init(el) {
        container = el;
        loadUsers();
    }

    function loadUsers() {
        Auth.getUsers().then(function(data) {
            if (!data) data = {};
            if (Array.isArray(data)) {
                users = data;
            } else if (Array.isArray(data.users)) {
                users = data.users;
            } else {
                users = [];
            }
            users = users.filter(function(user) {
                return user && user.username;
            });
            render();
        }).catch(function(err) {
            container.innerHTML = "div class=error" + err.message + "/div";
        });
    }

    function render() {
        container.innerHTML = [
            "div class=toolbar",
            "  div class=search-box",
            "    input type=text id=userSearch placeholder='Search users...'",
            "  /div",
            "  button class=btn-primary id=addUserBtnAdd User/button",
            "/div",
            "table class=data-table",
            "  thead",
            "    tr",
            "      thID/th",
            "      thUsername/th",
            "      thRole/th",
            "      thCreated At/th",
            "      thActions/th",
            "    /tr",
            "  /thead",
            "  tbody id=userList/tbody",
            "/table",
            "div id=userModal/div"
        ].join("");
    }

    function setupEventListeners() {
        var searchInput = document.getElementById("userSearch");
        if (searchInput) {
            searchInput.addEventListener("input", function(e) {
                filterUsers(e.target.value);
            });
        }
    }

    function filterUsers(query) {
        var filtered = users.filter(function(user) {
            return user.username.toLowerCase().indexOf(query.toLowerCase()) !== -1;
        });
        var tbody = document.getElementById("userList");
        tbody.innerHTML = filtered.map(function(user) {
            return "trtd" + user.id + "/tdtd" + user.username + "/tdtd" + user.role + "/td/tr";
        }).join("");
    }

    return {init:init};
})();
