var request = require('request');
var cheerio = require('cheerio');
var async =  require('async');
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
var imgur = require('imgur');
var wait=require('wait.for-es6');
var express = require('express');

var app = express();


var port = process.env.PORT || 5000;


function getOptions(url){
   var separateReqPool = {maxSockets: 50};
   return  {
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
                },
                method: 'GET',
                pool: separateReqPool
                
   };
}

app.route('/')
    .get(function(req, res){

        let urlStory = req.query.url;
        let _categories = [];
        let _stories = [];
        let _countRequest = 0;
        var DoneFunction = function(){
            /*console.log('----------------------------');
            var filename = 'stories.json';
            fs.writeFile(filename, JSON.stringify(_stories));
            console.log('Stories data saved in: ' + __dirname + '/' + filename);
            console.log('Total chaps: ' + _stories.length);
            console.log('----------------------------');
            var filename1 = 'category.json';
            
            fs.writeFile(filename1, JSON.stringify(_categories));
            console.log('Categories metadata save in: ' + __dirname + '/' + filename1)
            console.log('Total stories: ' + _categories.length);
            console.log('----------------------------');
            console.log('Total requests: ' + _countRequest);
            */
            res.json({stories: _stories, cat: _categories}).end();
        };

        function getMaxPageNo($, element)
        {
            let max = -1;
                        if ($('ul.pagination').length != 0)
                        {
                            let length = $('ul.pagination li a').length;
                            
                            if (length <= 4)
                            {
                                max = +$($('ul.pagination li a')[length - 2]).html();
                            }
                            else
                            {
                                if ($($('ul.pagination li a')[length - 1]).html().indexOf('Cuối') >= 0)
                                {
                                    max = +$($('ul.pagination li a')[length - 1]).attr('title').split('- Trang ')[1];
                                
                                }
                                else
                                {
                                    max = +$($('ul.pagination li a')[length - 2]).attr('title').split('- Trang ')[1];
                                    
                                }
                            }
                        }
                        else max = 1;
                return max;
        }
        function getArrayPageNo(max){
            let arr = [];
            for (let i = 1; i <= max; i++)
            {
                arr.push(i);
            }
            return arr;
        }
        function GetRequestPage(url){
            let req = request(getOptions(url), function(error, response, body) {
                _countRequest++;
                if(error || response.statusCode != 200) {
                console.log("Error: " + error);
                }
                let $ = cheerio.load(body, { decodeEntities: false });
                let lstStories = $($('.list.list-truyen.col-xs-12')[0]).find('.row').map((i, element) => {
                    let category = {};
                    category._id = new ObjectID().toString('hex');
                    category.author = $(element).find('span.author').html().split('</span> ')[1];
                    category.totalchap = 0;
                    category.stories = [];
                    category.img = '';
                    category.postby = {
                        $oid: '58d0a633f36d281bf6178b97'
                    }
                    category.introduce = '';
                    category.types = [];
                    category.type = 1;

                    let link = $(element).find('.truyen-title a').attr('href');
                    return {category: category, link};
                });
                
                var tasks = lstStories.map((i, element) => {
                    return function(callback)
                    {
                        let req = request(getOptions(element.link), function(err, response, body){
                            _countRequest++;
                            let $ = cheerio.load(body, { decodeEntities: false });
                            let cat = element.category;
                            cat.text_pre = $('.desc-text.desc-text-full').text();
                            cat.img_pre = $('.book img').attr('src');
                            cat.name = $('h3.title').html();
                            let max = getMaxPageNo($, element);
                            let lstPages = getArrayPageNo(max);
                            let taskPages = lstPages.map(function(chap){
                                return function(callback){
                                    let urlPage = element.link + 'trang-' + chap;
                                    let req = request(getOptions(urlPage), function(err, response, body){
                                        _countRequest++;
                                        if (err)
                                        {
                                            console.log(err);
                                            callback(err, null);
                                        }
                                        let $ = cheerio.load(body, { decodeEntities: false });
                                        let lstStories = $('.list-chapter li a').map(function(index, e){
                                            let object = {};
                                            object.link = $(e).attr('href');
                                        
                                            object.name = ($(e).html().split(':')[1] ? $(e).html().split(':')[1].trim(): "");
                                            object.chap = (chap - 1) * 50 + index + 1;
                                            return object;
                                        });
                                        async.map(lstStories, function(object, callback){
                                            let story = {};
                                            story._id = { $oid: new ObjectID().toString('hex')};
                                            story.cat = {
                                                $oid : cat._id
                                            };
                                            story.part = object.chap;
                                            story.name = object.name;
                                            story.date = {
                                                $date: new Date()
                                            }
                                            story.img_pre = cat.img_pre;
                                            story.text_pre = '';
                                            story.img_main = [];
                                            
                                            let req  = request(getOptions(object.link), function(err, request, body){
                                                console.log(object.link);
                                                _countRequest++;
                                                if (err)
                                                {
                                                    console.log(err);
                                                    callback(err, null);
                                                }
                                                else
                                                {
                                                    let $ = cheerio.load(body, { decodeEntities: false });
                                                    story.content = $('.chapter-c').html();
                                                    _stories.push(story);
                                                    callback(null, story);
                                                
                                                }
                                            });
                                            req.end();
                                        }, function(err, stories){
                                            if (err)
                                            {
                                                console.log(err);
                                            }
                                            else callback(null, stories);
                                        });

                                    });
                                    req.end();
                                }
                            });
                            async.parallel(taskPages, function(err, results){
                                if (err)
                                {
                                    console.log(err);
                                }
                                else
                                {
                                    let storiesall = [];
                                    results.forEach(function(stories, index){
                                        storiesall = storiesall.concat(stories);
                                    });
                                    cat.totalchap = storiesall.length;
                                    cat.stories = storiesall.map(function(story){
                                        return story._id;
                                    });
                                    _categories.push(cat);
                                    callback(null, results);
                                }
                            });
                        });
                        req.end();
                    }
                })
                async.parallel(tasks, function(err, results){
                    if (err)
                    {
                        console.log(err);
                    }
                    else
                    {
                        DoneFunction();
                    }
                });
                category = new ObjectID().toString('hex');
                category
            });
            req.end();
        }

        GetRequestPage(urlStory);

        });

app.listen(port, function(){
    console.log('app is listening on port ' + port);
})

/*
var host = "http://truyenfull.vn";
let urlStory = '';
if (process.argv[2])
{
    urlStory = process.argv[2];
}
else urlStory = "http://truyenfull.vn/danh-sach/truyen-full/";
*/




