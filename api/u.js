const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs')

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');

const { lookup } = require('geoip-lite');

const ejs = require('ejs');
const cookieParser = require('cookie-parser');

const postsDir = path.join(__dirname, '../data/posts/');

router.use(cookieParser());
router.get('/u/:username', function (request, response) {
    if (request.params.username) {
        let username = request.params.username;
        let query = `SELECT * FROM users WHERE UPPER(username) LIKE UPPER('${username}')`;

        db.get(query, function(err, row) {
            if (typeof row != "undefined")
            {
                let banQuery = `SELECT * FROM bans WHERE banned_id='${row.id}'`;

                let dataUser = {
                    id: row.id,
                    username: row.username,
                    mood: row.mood,
                    sub_until: row.sub_until,
                    name_color: row.name_color,
                    last_online: row.last_online,
                };

                let pageData = {
                    userData: dataUser,
                    postData: { posts: [] },
                    adminData: undefined,
                }

                if (fs.existsSync(postsDir + `users/posts_${row.id}.json`)) {
                    let data = fs.readFileSync(postsDir + `users/posts_${row.id}.json`, 'utf8');
                    pageData.postData = JSON.parse(data);
                    pageData.postData.posts.sort(function(a, b) {
                        return b.timestamp - a.timestamp;
                    });

                    pageData.postData.posts.sort(function(a, b) {
                        return (a.pinned === b.pinned) ? 0 : a.pinned? -1 : 1;
                    });

                    let alreadyViewed = false;
                    for (let i = 0; i < pageData.postData.posts.length; i++)
                    {
                        if (pageData.postData.posts[i].views.length > 0)
                        {
                            pageData.postData.posts[i].views.forEach(viewer => {
                                if (viewer.ip 
                                === request.socket.remoteAddress.split(":")[3])
                                {
                                    alreadyViewed = true;
                                }
                            });

                            if (!alreadyViewed)
                            {
                                pageData.postData.posts[i].views.push({ ip: request.socket.remoteAddress.split(":")[3] });
                            }
                        } else {
                            pageData.postData.posts[i].views.push({ ip: request.socket.remoteAddress.split(":")[3] });
                        }
                    }

                    fs.writeFileSync(postsDir + `users/posts_${row.id}.json`, JSON.stringify(pageData.postData));
                } else {
                    fs.closeSync(fs.openSync(postsDir + `users/posts_${row.id}.json`, 'w'));

                    let blankData = {
                        posts: [],
                    };
                    fs.writeFileSync(postsDir + `users/posts_${row.id}.json`, JSON.stringify(blankData));
                }

                db.get(banQuery, function(err, banRow) {
                    if (typeof banRow != "undefined")
                    {
                        if (Date.now() > banRow.until)
                        {
                            let timeDiff = Date.now() - banRow.until;
                            let days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                            pageData.banData = {
                                lastBanDays: days
                            };

                            if (request.cookies.accessToken)
                            {
                                let adminQuery = `SELECT * FROM users WHERE accessToken='${request.cookies.accessToken}'`;
                                db.get(adminQuery, function (err, adminRow) {
                                    if (typeof adminRow != "undefined") {
                                        if (adminRow.admin >= 1 && adminRow.admin > row.admin) {
                                            let date = new Date(Number(row.reg_date));
                                            let dateDay = "0" + date.getDate();
                                            let months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    
                                            pageData.adminData = {
                                                registerIP: row.reg_ip,
                                                place: lookup(row.reg_ip),
                                                regDate: dateDay.substr(-2) + " " + months[date.getMonth()] + " " + date.getFullYear(),
                                                accounts: [],
                                            };

                                            let accountsQuery = `SELECT * FROM users WHERE reg_ip='${row.reg_ip}'`;
                                            db.all(accountsQuery, function(err, accounts)
                                            {
                                                if (typeof accounts != "undefined")
                                                {
                                                    if (accounts.length != 0)
                                                    {
                                                        for (let i = 0; i < accounts.length; i++)
                                                        {
                                                            pageData.adminData.accounts.push({ id: accounts[i].id, name: accounts[i].username, name_color: accounts[i].name_color });

                                                            if (i === accounts.length - 1)
                                                            {
                                                                response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                                            }
                                                        }  
                                                    }
                                                }
                                            });
                                        } else {
                                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                        }
                                    } else {
                                        response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                    }
                                });
                            } else {
                                response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                            }
                        } else {
                            response.render(path.join(__dirname, '../web/account/profilepages/profileBan.ejs'));
                        }
                    } else {
                        if (request.cookies.accessToken)
                        {
                            let adminQuery = `SELECT * FROM users WHERE accessToken='${request.cookies.accessToken}'`;
                            db.get(adminQuery, function (err, adminRow) {
                                if (typeof adminRow != "undefined") {
                                    if (adminRow.admin >= 1 && adminRow.admin > row.admin) {
                                        let date = new Date(Number(row.reg_date));
                                        let dateDay = "0" + date.getDate();
                                        let months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];

                                        pageData.adminData = {
                                            registerIP: row.reg_ip,
                                            place: lookup(row.reg_ip),
                                            regDate: dateDay.substr(-2) + " " + months[date.getMonth()] + " " + date.getFullYear(),
                                            accounts: [],
                                        };

                                        let accountsQuery = `SELECT * FROM users WHERE reg_ip='${row.reg_ip}'`;
                                        db.all(accountsQuery, function(err, accounts)
                                        {
                                            if (typeof accounts != "undefined")
                                            {
                                                if (accounts.length != 0)
                                                {
                                                    for (let i = 0; i < accounts.length; i++)
                                                    {
                                                        pageData.adminData.accounts.push({ id: accounts[i].id, name: accounts[i].username, name_color: accounts[i].name_color });

                                                        if (i === accounts.length - 1)
                                                        {
                                                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                                        }
                                                    }  
                                                }
                                            }
                                        });
                                    } else {
                                        response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                    }
                                } else {
                                    response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                }
                            });
                        } else {
                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                        }
                    }
                });
            } else {
                response.render(path.join(__dirname, '../web/account/profilepages/profileNotExist.ejs'));
            }
        });
    }
});

router.get('/id/:uid', function (request, response) {
    if (request.params.uid) {
        let query = `SELECT * FROM users WHERE id='${request.params.uid}'`;
        db.get(query, function(err, row) {
            if (typeof row != "undefined")
            {
                let banQuery = `SELECT * FROM bans WHERE banned_id='${row.id}'`;

                let dataUser = {
                    id: row.id,
                    username: row.username,
                    mood: row.mood,
                    sub_until: row.sub_until,
                    name_color: row.name_color,
                    last_online: row.last_online,
                };

                console.log(dataUser);

                let pageData = {
                    userData: dataUser,
                    postData: { posts: [] },
                    adminData: undefined,
                }

                if (fs.existsSync(postsDir + `users/posts_${row.id}.json`)) {
                    let data = fs.readFileSync(postsDir + `users/posts_${row.id}.json`, 'utf8');
                    pageData.postData = JSON.parse(data);
                    pageData.postData.posts.sort(function(a, b) {
                        return b.timestamp - a.timestamp;
                    });
                } else {
                    fs.closeSync(fs.openSync(postsDir + `users/posts_${row.id}.json`, 'w'));

                    let blankData = {
                        posts: [],
                    };
                    fs.writeFileSync(postsDir + `users/posts_${row.id}.json`, JSON.stringify(blankData));
                }

                db.get(banQuery, function(err, banRow) {
                    if (typeof banRow != "undefined")
                    {
                        if (Date.now() > banRow.until)
                        {
                            let timeDiff = Date.now() - banRow.until;
                            let days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                            pageData.banData = {
                                lastBanDays: days
                            };

                            if (request.cookies.accessToken)
                            {
                                let adminQuery = `SELECT * FROM users WHERE accessToken='${request.cookies.accessToken}'`;
                                db.get(adminQuery, function (err, adminRow) {
                                    if (typeof adminRow != "undefined") {
                                        if (adminRow.admin >= 1 && adminRow.admin > row.admin) {
                                            let date = new Date(Number(row.reg_date));
                                            let dateDay = "0" + date.getDate();
                                            let months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    
                                            pageData.adminData = {
                                                registerIP: row.reg_ip,
                                                place: lookup(row.reg_ip),
                                                regDate: dateDay.substr(-2) + " " + months[date.getMonth()] + " " + date.getFullYear(),
                                                accounts: [],
                                            };

                                            let accountsQuery = `SELECT * FROM users WHERE reg_ip='${row.reg_ip}'`;
                                            db.all(accountsQuery, function(err, accounts)
                                            {
                                                if (typeof accounts != "undefined")
                                                {
                                                    if (accounts.length != 0)
                                                    {
                                                        for (let i = 0; i < accounts.length; i++)
                                                        {
                                                            pageData.adminData.accounts.push({ id: accounts[i].id, name: accounts[i].username, name_color: accounts[i].name_color });

                                                            if (i === accounts.length - 1)
                                                            {
                                                                response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                                            }
                                                        }  
                                                    }
                                                }
                                            });
                                        } else {
                                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                        }
                                    } else {
                                        response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                    }
                                });
                            } else {
                                response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                            }
                        } else {
                            response.render(path.join(__dirname, '../web/account/profilepages/profileBan.ejs'));
                        }
                    } else {
                        if (request.cookies.accessToken)
                        {
                            let adminQuery = `SELECT * FROM users WHERE accessToken='${request.cookies.accessToken}'`;
                            db.get(adminQuery, function (err, adminRow) {
                                if (typeof adminRow != "undefined") {
                                    if (adminRow.admin >= 1 && adminRow.admin > row.admin) {
                                        let date = new Date(Number(row.reg_date));
                                        let dateDay = "0" + date.getDate();
                                        let months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];

                                        pageData.adminData = {
                                            registerIP: row.reg_ip,
                                            place: lookup(row.reg_ip),
                                            regDate: dateDay.substr(-2) + " " + months[date.getMonth()] + " " + date.getFullYear(),
                                            accounts: [],
                                        };

                                        let accountsQuery = `SELECT * FROM users WHERE reg_ip='${row.reg_ip}'`;
                                        db.all(accountsQuery, function(err, accounts)
                                        {
                                            if (typeof accounts != "undefined")
                                            {
                                                if (accounts.length != 0)
                                                {
                                                    for (let i = 0; i < accounts.length; i++)
                                                    {
                                                        pageData.adminData.accounts.push({ id: accounts[i].id, name: accounts[i].username, name_color: accounts[i].name_color });

                                                        if (i === accounts.length - 1)
                                                        {
                                                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                                        }
                                                    }  
                                                }
                                            }
                                        });
                                    } else {
                                        response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                    }
                                } else {
                                    response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                                }
                            });
                        } else {
                            response.render(path.join(__dirname, '../web/account/profilepages/profile.ejs'), pageData);
                        }
                    }
                });
            } else {
                response.render(path.join(__dirname, '../web/account/profilepages/profileNotExist.ejs'));
            }
        });
    }
});

module.exports = router;