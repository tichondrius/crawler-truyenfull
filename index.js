var request = require('request');
var cheerio = require('cheerio');
var async =  require('async');
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
var imgur = require('imgur');
var wait=require('wait.for-es6');
var host = "http://truyenfull.vn";
var urlStory = "http://truyenfull.vn/danh-sach/truyen-moi/";

let categories = [];
let countChap = 0;
let countStory = 0;

function getOptions(url){
  return  {
          url: url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
          },
		  pool: false
          
  };
}
var DoneFunction = function(result){
    result = result.map(rs => {
        rs.date = {
            $date: new Date(rs.date)
        };
        return rs;
    });
    var filename = 'stories.json';
    fs.writeFile(filename, JSON.stringify(result));
    console.log('Stories data saved in: ' + __dirname + '/' + filename);
    console.log('Total chap: ' + result.length);
    var filename1 = 'category.json';
    fs.writeFile(filename1, JSON.stringify(categories));
    console.log('Stories metadata save in: ' + __dirname + '/' + filename1)
    
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
    let req = request.get(getOptions(url), function(error, response, body) {
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
                    let $ = cheerio.load(body, { decodeEntities: false });
                    let cat = element.category;
                    cat.text_pre = $('.desc-text.desc-text-full').text();
                    cat.img_pre = $('.book img').attr('src');
                    cat.name = $('h3.title').html();
                    let max = getMaxPageNo($, element);
                    let lstPages = getArrayPageNo(max);
					countStory++;
                    let taskPages = lstPages.map(function(chap){
                        return function(callback){
                            let urlPage = element.link + 'trang-' + chap;
                            let req = request(getOptions(urlPage), function(err, response, body){
                                if (err)
                                {
                                    console.log(err);
                                    callback(err, null);
                                }
                                let $ = cheerio.load(body, { decodeEntities: false });
                                let lstStories = $('.list-chapter li a').map(function(index, e){
                                    let object = {};
                                    object.link = $(e).attr('href');
                                    console.log(object.link);
                                    object.name = ($(e).html().split(':')[1] ? $(e).html().split(':')[1].trim(): "");
                                    object.chap = (chap - 1) * 50 + index + 1;
                                    return object;
                                });
                                async.map(lstStories, function(object, callback){
                                    let story = {};
                                    story._id = new ObjectID().toString('hex');
                                    cat.stories.push({$oid: story.id});
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
									/*
                                    request(getOptions(object.link), function(err, request, body){
                                        if (err)
                                        {
                                            console.log(err);
                                            callback(err, null);
                                        }
                                        else
                                        {
                                            let $ = cheerio.load(body, { decodeEntities: false });
                                            story.content = $('.chapter-c').html();
                                            console.log(story);
                                            
                                        }
                                        
                                    });
									*/
									console.log(story);
									countChap++;
									callback(null, story);
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
				console.log('totalchap: ' + countChap);
				console.log('totalstory: ' + countStory);
				
            }
        });


        
        category = new ObjectID().toString('hex');
        category
    });
	req.end();

}

GetRequestPage(urlStory);
