const puppeteer = require('puppeteer');
const fs = require('fs');
var ceps = fs.readFileSync('cepsTim.txt', 'utf-8').split('\n');
fs.writeFileSync('linksTim.txt', '', function () { console.log('Arquivo limpo.') });
const url = 'https://lojaonline.tim.com.br/';
const url2 = 'https://lojaonline.tim.com.br/celulares';
var tempoEspera = 60000;

const prepararParaTestes = async (page) => {
	// Pass the User-Agent Test.
	const userAgent = 'Mozilla/5.0 (X11; Linux x86_64)' +
	    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.39 Safari/537.36';
	  await page.setUserAgent(userAgent);

  // Pass the Webdriver Test.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // Pass the Chrome Test.
  await page.evaluateOnNewDocument(() => {
    // We can mock this in as much depth as we need for the test.
    window.navigator.chrome = {
      runtime: {},
      // etc.
    };
  });

  // Pass the Permissions Test.
  await page.evaluateOnNewDocument(() => {
    const originalQuery = window.navigator.permissions.query;
    return window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });

  // Pass the Plugins Length Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'plugins', {
      // This just needs to have `length > 0` for the current test,
      // but we could mock the plugins too if necessary.
      get: () => [1, 2, 3, 4, 5],
    });
  });

  // Pass the Languages Test.
  await page.evaluateOnNewDocument(() => {
    // Overwrite the `plugins` property to use a custom getter.
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
}

const opts = {
    headless: false,
    defaultViewport: null,
    args: [
        '--start-maximized',
	    '--no-sandbox',
    ]
};

puppeteer.launch(opts).then(async browser => {
	const page = await browser.newPage();
    //tirando o timeout
    await page.setDefaultNavigationTimeout(0);	
	var list = [];
	await prepararParaTestes(page);
    for(let cep of ceps){
        try {
            console.log('cep: ' + cep);
			await page.goto(url);
			await page.waitFor(20000);
			await page.click('a[class="regional"]')
	        await page.waitFor('input[id="zipcode"]')
	        await page.type('input[id="zipcode"]', cep)
			await page.click('label[for="client_check_2"]')
			await page.click('input[data-ng-click="submitInfos()"]')
			await page.waitFor(20000)
			
			await page.evaluate(async () => {
				await new Promise((resolve, reject) => {
					let totalHeight = 0;
			      	let distance = 100;
			      	let timer = setInterval(() => {
			        	let scrollHeight = document.body.scrollHeight
			        	window.scrollBy(0, distance)
			        	totalHeight += distance;
			        	if(totalHeight >= scrollHeight){
			          		clearInterval(timer);
			          		resolve();
			        	}
					}, 500);
			    })
			})
			
			
			var links =  await page.evaluate(function(){
	            return Array.from(document.querySelectorAll('a.offer')).map(element => element.href);           
			});		
			var obj = {};
			obj.cep = cep;
			obj.urls = [];
			obj.urls = links
			list.push(obj);
			var file = fs.createWriteStream('linksTim.txt', {flags: 'a'});
			if(obj.urls.length > 0){
				file.write(obj.cep + '\r\n');
				for(let url of obj.urls){
					var aparelho = url.split('/')[5].slice(0, -8).replace(/-/g, ' ');
					file.write(apenasAparelho(url) + '\r\n') ;
					for(var i = 1; i <= 6; i++){
		          		file.write(formatarLink(url, i) +  '\r\n');
					}
				};			
			}
					
				file.end();
        } catch (err) {
            console.log('Erro ao navegar para a página: ' + err);
        }
    }
    //por fim, vai fechar o navegador
    await browser.close();
});


function apenasAparelho(link){
    return link.substring(0, link.lastIndexOf('/') + 1) + 'apenas-aparelho';
}

function formatarLink(link, indice){	
	if(indice == 1){
		return link.substring(0, link.lastIndexOf('/') + 1) + 'controle-2.0gb-fid-novalinha';
	}else if(indice == 2){
		return link.substring(0, link.lastIndexOf('/') + 1) + 'pos_7gb_social_fid-novalinha';		
	}else if(indice == 3){
		return link.substring(0, link.lastIndexOf('/') + 1) + 'tim-pos-10gb-plus-fid-novalinha';
	}else if(indice == 4){		
		return link.substring(0, link.lastIndexOf('/') + 1) + 'pos_15gb_plus_fid-novalinha';
	}else if(indice == 5){
		return link.substring(0, link.lastIndexOf('/') + 1) + 'tim-pos-20gb-plus-fid-novalinha';
	}else if(indice == 6){
		return link.substring(0, link.lastIndexOf('/') + 1) + 'tim-controle-2,0gb-novalinha';
	}
}

