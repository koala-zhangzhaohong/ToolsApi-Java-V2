let currentHost = "";
let jsonData = null;

function setCurrentHost(input) {
    currentHost = input;
}

function setData(input) {
    jsonData = input;
}

document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.querySelector('.search-input');
    const searchButton = document.querySelector('.search-button');
    const historyList = document.querySelector('.history-list');
    const clearHistoryBtn = document.querySelector('.clear-history');
    const refreshBtn = document.querySelector('.refresh-btn')
    const emptyHistory = document.querySelector('.empty-history');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');
    const rankList = document.getElementById('ranklist-table');
    const rankListEmptyData = document.getElementById('ranklist-empty-data');

    // 从localStorage加载搜索历史
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

    function updateRankListData() {
        const json = JSON.parse(jsonData);
        rankList.innerHTML = '';
        const title = document.createElement('tr');
        title.innerHTML = `<th>昵称</th><th>账号</th><th>原始昵称</th>`;
        rankList.appendChild(title);
        if (json.data.userList.length === 0) {
            rankListEmptyData.style.display = 'block';
        } else {
            rankListEmptyData.style.display = 'none';
            json.data.userList.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${item.nickname}</td><td>${item.display_id}</td><td>${item.user_real_nickname}</td>`;
                rankList.appendChild(tr);
            });
        }
    }

    // 更新显示历史记录
    function updateHistoryDisplay() {
        if (searchHistory.length === 0) {
            emptyHistory.style.display = 'block';
            historyList.innerHTML = '';
            historyList.appendChild(emptyHistory);
            return;
        }

        emptyHistory.style.display = 'none';
        historyList.innerHTML = '';

        // 只显示最近8条记录
        const recentHistory = searchHistory.slice(-8).reverse();

        recentHistory.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.innerHTML = `
                    <span class="history-text">${item}</span>
                    <div class="history-actions">
                        <button class="search-again"><i class="fas fa-search"></i></button>
                        <button class="delete-item"><i class="fas fa-times"></i></button>
                    </div>
                `;
            historyList.appendChild(li);

            // 添加再次搜索事件
            li.querySelector('.search-again').addEventListener('click', function () {
                searchInput.value = item;
                performSearch();
            });

            li.querySelector('.history-text').addEventListener('click', function () {
                searchInput.value = item;
            });

            // 添加删除单个记录事件
            li.querySelector('.delete-item').addEventListener('click', function () {
                const index = searchHistory.indexOf(item);
                if (index > -1) {
                    searchHistory.splice(index, 1);
                    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
                    updateHistoryDisplay();
                }
            });
        });
    }

    // 执行搜索
    function performSearch() {
        const searchInputValue = searchInput.value.trim();

        if (searchInputValue === '') {
            return;
        }

        // 添加到搜索历史（如果尚未存在）
        if (!searchHistory.includes(searchInputValue)) {
            searchHistory.push(searchInputValue);
            // 只保留最多20条记录
            if (searchHistory.length > 20) {
                searchHistory.shift();
            }
            localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        }

        updateHistoryDisplay();

        // 在实际应用中，这里会执行搜索操作
        // 此处仅做演示
        // alert(`正在搜索: ${searchTerm}`);
        window.location.href = `${currentHost}tools/DouYin/api?version=4&type=simple&directJsonViewer=true&link=` + encodeURIComponent(searchInputValue)
        searchInput.value = '';
    }

    // 搜索按钮点击事件
    searchButton?.addEventListener('click', performSearch);

    // 按回车键搜索
    searchInput?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 清空历史记录
    clearHistoryBtn?.addEventListener('click', function () {
        searchHistory = [];
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        updateHistoryDisplay();
    });

    refreshBtn?.addEventListener('click', function () {
        window.location.reload();
    });

    // 建议词点击事件
    suggestionChips?.forEach(chip => {
        chip.addEventListener('click', function () {
            searchInput.value = this.getAttribute("data-input");
            // performSearch();
        });
    });

    // 初始化显示
    if (emptyHistory !== undefined && emptyHistory !== null) {
        updateHistoryDisplay();
    }

    if (rankList !== undefined && rankList !== null && rankListEmptyData !== undefined && rankListEmptyData !== null) {
        updateRankListData();
    }
});