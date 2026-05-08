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
    const apiEmptyData = document.getElementById('api-empty-data');
    const apiData = document.getElementById('api-data');
    const apiInfoData = document.getElementById('info-container');
    const apiRanklistInfoData = document.getElementById('info-ranklist-container');
    const apiPreviewInfoData = document.getElementById('info-preview-container');
    const apiDownloadInfoData = document.getElementById('info-download-container');

    // 从localStorage加载搜索历史
    let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

    function updateApiData() {
        const json = JSON.parse(jsonData);
        apiData.innerHTML = '';
        if (json === null || jsonData === null || json === undefined) {
            apiEmptyData.style.display = 'block';
            apiInfoData.style.display = 'none';
            apiRanklistInfoData.style.display = 'none';
            apiPreviewInfoData.style.display = 'none';
            apiDownloadInfoData.style.display = 'none';
        } else {
            apiEmptyData.style.display = 'none';
        }

        if (checkIsNotEmptyArr(json.media_data.proxy_preview_path)) {
            const div = document.createElement('div');
            div.innerHTML = `<iframe src="${json.media_data.proxy_preview_path[0]}" frameborder="0" width="100%" height="auto" scrolling="auto" style="height: 60vh"></iframe>`;
            apiData.appendChild(div);
        }

        if (checkIsNotEmptyContent(json.media_data.preview_path_hls) || checkIsNotEmptyContent(json.media_data.preview_path_flv)) {
            let url = '';
            if (checkIsNotEmptyContent(json.media_data.preview_path_hls)) {
                url = json.media_data.preview_path_hls;
            } else {
                url = json.media_data.preview_path_flv;
            }
            const div = document.createElement('div');
            div.innerHTML = `<iframe src="${url}&lastKey=${localStorage.getItem("last_live_key")}" frameborder="0" width="100%" height="auto" scrolling="auto" style="height: 60vh"></iframe>`;
            apiData.appendChild(div);
            localStorage.setItem("last_live_key", getQueryVariable(url, "key"));
        }

        if (checkIsNotEmptyContent(json.media_data.preview_path)) {
            if (json.media_data.preview_path.startsWith(currentHost + "tools/DouYin/pro/player/picture/short") || json.media_data.preview_path.startsWith(currentHost + "tools/DouYin/pro/player/music/short")) {
                const div = document.createElement('div');
                div.innerHTML = `<iframe src="${json.media_data.preview_path}" frameborder="0" width="100%" height="auto" scrolling="auto" style="height: 60vh"></iframe>`;
                apiData.appendChild(div);
            }
        }

        const infoWrapper = apiInfoData.querySelector('.info-wrapper');
        let desc = undefined;
        if (checkIsNotEmptyContent(json.desc)) {
            desc = json.desc;
        } else if (checkIsNotEmptyContent(json.title)) {
            desc = json.title;
        }
        let id = undefined;
        if (checkIsNotEmptyContent(json.unique_id)) {
            id = json.unique_id;
        } else if (checkIsNotEmptyContent(json.room_id)) {
            id = json.room_id;
        } else if (checkIsNotEmptyContent(json.song_id)) {
            id = json.song_id;
        }
        let uid = undefined;
        if (checkIsNotEmptyContent(json.user_id)) {
            uid = json.user_id;
        } else if (checkIsNotEmptyContent(json.sec_uid)) {
            uid = json.sec_uid;
        }
        infoWrapper.innerHTML = `<div class="info-desc">${getTextContent(desc)}</div><div class="info-nickname">${getTextContent(json.nickname)}</div><div class="info-unique-id">${getTextContent(id)}</div><div class="info-user-id">${getTextContent(uid)}</div>`;
        apiInfoData.style.display = 'block';

        const infoRanklistWrapper = apiRanklistInfoData.querySelector('.info-wrapper');
        if (checkIsNotEmptyContent(json.rank_data.rank_list_url) || checkIsNotEmptyContent(json.rank_data.rank_list_url_backup)) {
            if (checkIsNotEmptyContent(json.rank_data.rank_list_url)) {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = `${currentHost}tools/json/printer/pro?path=${encodeURIComponent(Util.htmlspecialchars_decode(json.rank_data.rank_list_url))}`;
                a.textContent = '用户查询[简略]';
                infoRanklistWrapper.appendChild(a);
            }
            if (checkIsNotEmptyContent(json.rank_data.rank_list_url_backup)) {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = `${currentHost}tools/json/printer/pro?path=${encodeURIComponent(Util.htmlspecialchars_decode(json.rank_data.rank_list_url_backup))}`;
                a.textContent = '用户反查[Pro]';
                infoRanklistWrapper.appendChild(a);
            }
            if (checkIsNotEmptyArr(json.rank_data.rank_list_special)) {
                json.rank_data.rank_list_special.forEach((item) => {
                    let prefix = undefined;
                    for (const param of item.split('&')) {
                        const [key, value] = param.split('=');
                        if ("nickname" === key) {
                            prefix = value;
                            break;
                        }
                    }
                    const a = document.createElement('a');
                    a.className = 'info-button';
                    a.href = `${currentHost}tools/json/printer/pro?path=${encodeURIComponent(Util.htmlspecialchars_decode(item))}`;
                    a.textContent = prefix + " - 用户反查";
                    infoRanklistWrapper.appendChild(a);
                });
            }
            apiRanklistInfoData.style.display = 'block';
        } else {
            apiRanklistInfoData.style.display = 'none';
        }

        let apiPreviewStateLock = false;
        const infoPreviewWrapper = apiPreviewInfoData.querySelector('.info-wrapper');
        if (checkIsNotEmptyArr(json.media_data.proxy_preview_path) && !apiPreviewStateLock) {
            apiPreviewStateLock = true;
            json.media_data.proxy_preview_path.forEach((item, index) => {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = item;
                a.textContent = '线路 - ' + (index + 1);
                infoPreviewWrapper.appendChild(a);
            });
            if (checkIsNotEmptyContent(json.media_data.preview_path)) {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = json.media_data.preview_path;
                a.textContent = '回源 [无代理]';
                infoPreviewWrapper.appendChild(a);
            }
            apiPreviewInfoData.style.display = 'block';
        } else {
            apiPreviewInfoData.style.display = 'none';
        }

        if ((checkIsNotEmptyContent(json.media_data.preview_path_hls) || checkIsNotEmptyContent(json.media_data.preview_path_flv)) && !apiPreviewStateLock) {
            apiPreviewStateLock = true;
            let state = false;
            if (checkIsNotEmptyContent(json.media_data.preview_path_flv)) {
                state = true;
                const flv = document.createElement('a');
                flv.className = 'info-button';
                flv.href = json.media_data.preview_path_flv;
                flv.textContent = '线路 - flv';
                infoPreviewWrapper.appendChild(flv);
            }
            if (checkIsNotEmptyContent(json.media_data.preview_path_hls)) {
                state = true;
                const hls = document.createElement('a');
                hls.className = 'info-button';
                hls.href = json.media_data.preview_path_hls;
                hls.textContent = '线路 - hls';
                infoPreviewWrapper.appendChild(hls);
            }
            if (state) {
                apiPreviewInfoData.style.display = 'block';
            } else {
                apiPreviewInfoData.style.display = 'none';
            }
        }

        if (checkIsNotEmptyContent(json.media_data.preview_path) && !apiPreviewStateLock) {
            if (json.media_data.preview_path.startsWith(currentHost + "tools/DouYin/pro/player/picture/short") || json.media_data.preview_path.startsWith(currentHost + "tools/DouYin/pro/player/music/short")) {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = json.media_data.preview_path;
                a.textContent = '线路 - 1';
                infoPreviewWrapper.appendChild(a);
                apiPreviewInfoData.style.display = 'block';
            } else {
                apiPreviewInfoData.style.display = 'none';
            }
        }

        const infoDownloadWrapper = apiDownloadInfoData.querySelector('.info-wrapper');
        if (checkIsNotEmptyArr(json.media_data.proxy_download_path)) {
            json.media_data.proxy_download_path.forEach((item, index) => {
                if (checkIsNotEmptyContent(item.hd)) {
                    const a = document.createElement('a');
                    a.className = 'info-button';
                    a.href = item.hd;
                    a.textContent = '线路 - ' + (index + 1) + ' [高清]';
                    infoDownloadWrapper.appendChild(a);
                }
                if (checkIsNotEmptyContent(item.sd)) {
                    const a = document.createElement('a');
                    a.className = 'info-button';
                    a.href = item.sd;
                    a.textContent = '线路 - ' + (index + 1) + ' [标清]';
                    infoDownloadWrapper.appendChild(a);
                }
            });
            if (checkIsNotEmptyContent(json.media_data.download_path)) {
                const a = document.createElement('a');
                a.className = 'info-button';
                a.href = json.media_data.download_path;
                a.textContent = '回源 [无代理]';
                infoDownloadWrapper.appendChild(a);
            }
            apiDownloadInfoData.style.display = 'block';
        } else {
            apiDownloadInfoData.style.display = 'none';
        }
    }

    function getTextContent(text) {
        if (text === null || text === undefined) {
            return 'undefined';
        }
        return text
    }

    function checkIsNotEmptyArr(arr) {
        if (arr === null || arr === undefined) {
            return false;
        }
        return arr.length > 0;
    }

    function checkIsNotEmptyContent(text) {
        if (text === null || text === undefined) {
            return false;
        }
        return text.length > 0;
    }

    function getQueryVariable(url, variable)
    {
        const query = url.split("?")[1];
        const vars = query.split("&");
        for (let i=0; i<vars.length; i++) {
            const pair = vars[i].split("=");
            if(pair[0] === variable){return pair[1];}
        }
        return "null";
    }

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
        } else if (searchHistory[searchHistory.length - 1] !== searchInputValue) {
            searchHistory.splice(searchHistory.indexOf(searchInputValue), 1);
            searchHistory.push(searchInputValue);
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

    if (apiData !== undefined && apiData !== null && apiEmptyData !== undefined && apiEmptyData !== null) {
        updateApiData();
    }
});