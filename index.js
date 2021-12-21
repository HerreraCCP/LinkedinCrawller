const fs = require('fs');
const xl = require('excel4node');
const fetch = require('node-fetch');
const Promise = require('bluebird');
const puppeteer = require('puppeteer');
const parseObject = require('./parseObj');
const dotenv = require('dotenv').config();

const modelScrapProfiles = {
  profileName: false,
  name: false,
  firstName: false,
  lastName: false,
  industryName: false,
  locationName: false,
  geoLocationName: false,
  student: false,
  entityUrn: false,
  occupation: false,
  publicIdentifier: false,
  headline: false,
  profileId: false,
  trackingId: false,
  profession: false,
  href: false,
  summary: false,
};

/**
 * A utility that brokers HTTP requests...
 *
 * @class Scrapper
 * @constructor Username and Password
 */
class Scrapper {
  constructor(username, password) {
    this.page = null;
    this.browser = null;
    this.accessToken = {};

    this.username = username;
    this.password = password;

    this.DICT = [
      'bcookie',
      'bscookie',
      'spectroscopyId',
      'timezone',
      'li_rm',
      'li_at',
      'liap',
      'JSESSIONID',
      'lidc',
      'UserMatchHistory',
    ];

    this._linkedin = 'https://www.linkedin.com';
    this._initialUrl = `${this._linkedin}/checkpoint/rm/sign-in-another-account?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin`;
    this._scrapeUrl = `${this._linkedin}/voyager/api/identity/profiles`;
    this._urlConnections =
      'https://www.linkedin.com/mynetwork/invite-connect/connections/';
  }

  async _createNewPage() {
    const pg = await this.browser.newPage();
    await pg.setViewport({ width: 1040, height: 768 });
    return pg;
  }

  /**
   * Descrição do método. Este método assíncrono inicia o projeto.
   *
   * @class init
   * @constructor
   */
  async init() {
    console.info('Iniciando...');
    try {
      this.browser = await puppeteer.launch({
        dumpio: true,
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
        ignoreHTTPSErrors: true,
        args: [
          '--fast-start',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--window-size=1040,768',
        ],
      });
      this.page = await this._createNewPage();
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Init had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo acessar a página iniciar e efetuar o login através dos dados que o arquivo .env contém.
   *
   * @method login
   * @return
   */
  async login() {
    console.info('Initial Login...');
    try {
      await this.page.goto(this._initialUrl, { waitUntil: 'load' });
      await this.page.type('#username', this.username);
      await this.page.type('#password', this.password);

      await this.page.keyboard.press('Enter');
      await this.page.waitForNavigation();
      console.info('The second step has been done...');
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Login had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo 'pegar' os cookies de navegação em tempo de execução.
   *
   * @method getCookies
   * @return {}
   */
  async getCookies() {
    console.info('Extraindo cookies...', this.DICT);
    try {
      const client = await this.page.target().createCDPSession();
      const sig = await client.send('Network.getAllCookies');
      this.cookies = sig?.cookies;
      console.info('The third step has been done...');
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Get Cookies had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo 'processar' os cookies de navegação que foram pegos no método acima.
   *
   * @method getCookies
   * @return {}
   */
  async processCookies() {
    try {
      if (!this.cookies) {
        console.info('Cookies não encontrados. Encerrando...');
        await this.page.close();
        process.exit(1);
      }

      console.info('Processando cookies...');
      const FN = (k) => this.DICT.includes(k.name);
      this.cookies = this.cookies.filter(FN);
      console.info('The fourth step has been done...');
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Process Cookies Cookies had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo 'gerar' os tokens que foram processados pelos cookies anteriormente.
   *
   * @method generateTokens
   * @return {}
   */
  async generateTokens() {
    console.info('The tokens are generating...and the magic happens...');
    try {
      const str = this.cookies.reduce((acc, item) => {
        return `${acc};${item.name}=${item.value}`;
      }, '');

      const token = this.cookies.find((k) => k.name === 'JSESSIONID')?.value;

      this.accessToken = {
        cookie: str.slice(1),
        token: token.replace(/["]/gi, ''),
      };
      console.info('The fifth step has been done...');
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Generate Tokens had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo pegar os dados e as informações da página inicial do usuário.
   *
   * @method loadDataMaster
   * @return {...profile,...info, profileId: info.entityUrn} Este método retorna o profile e todas as informações que a página contém.
   */
  async loadDataMaster() {
    console.log('Carregando dados do master');
    try {
      const page = await this._createNewPage();
      await Promise.all([
        page.waitForNavigation(),
        page.goto(this._urlConnections, {
          waitUntil: ['load', 'domcontentloaded'],
          timeout: 0,
        }),
      ]);
      await page.waitForTimeout(600);
      await this.__autoScroll(page);

      //pega todos os hrefs
      this.masterHref = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            '#main div section div ul li a.ember-view.mn-connection-card__picture'
          ),
          (a) => a.getAttribute('href').replace(/\/+$/g, '').replace('/in/', '')
        )
      );

      this.masterName = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            '#main div section div ul li span.mn-connection-card__name'
          ),
          (a) => a.innerText
        )
      );

      await page.waitForTimeout(600);

      this.listContactMaster = await Promise.all(
        this.masterHref.map(async (d, i) => {
          const profile = {
            profileName: d,
            name: this.masterName[i],
          };
          const info = await this.scrapProfile(profile.profileName);
          return {
            ...profile,
            ...info,
            profileId: info?.entityUrn
              .toString()
              .replace('urn:li:fs_miniProfile:', '%22')
              .replace('urn:li:fs_profile:', ''),
          };
        })
      );
      console.info('The sixth step has been done...');
      page.close();
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `Generate Tokens had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo pegar todos as conexões dos usuários a partir do usuário logado.
   *
   * @method loadContactConnections
   * @return {}
   */
  async loadContactConnections() {
    console.info('loading the contacts...');
    let contacts = [];
    try {
      for (const key in this.listContactMaster) {
        let contactMaster = this.listContactMaster[key];
        const page = await this._createNewPage();
        console.log('profileId', contactMaster.profileId);
        // direciona para pagina de conexoes
        const url = `https://www.linkedin.com/search/results/people/?connectionOf=%5B${contactMaster.profileId}%22%5D&network=%5B%22F%22%2C%22S%22%5D&origin=MEMBER_PROFILE_CANNED_SEARCH&sid=%3B_.`;

        await Promise.all([
          page.waitForNavigation(),
          page.goto(url.replace(/\"/g, ''), {
            waitUntil: ['load', 'domcontentloaded'],
            timeout: 0,
          }),
        ]);

        await this.__autoScroll(page);

        // total de conexoes do contato
        let buttonNextElm = await page.$(
          '#main > div > div > div.artdeco-card > div > div .artdeco-pagination__button--next'
        );

        // total de conexoes do contato
        let countConections = await page.evaluate(() =>
          Array.from(
            document.querySelectorAll('#main > div > div > div.pb2'),
            (el) => el.innerText.replace(/\D+/g, '')
          )
        );

        const elements = await page.waitForSelector('#main', {
          waitUntil: ['load', 'domcontentloaded'],
          timeout: 0,
        });

        let countRegistryPage = await elements.$$eval(
          'div > div > div > ul.reusable-search__entity-results-list li.reusable-search__result-container span.entity-result__title-text > a.app-aware-link span span[aria-hidden]',
          (el) => el.map((x) => x.innerText)
        );

        // descobre a ultima pagina
        const countPagesConections =
          countConections > 0 ? Math.round(countConections / 10) : 1;

        let erroCount = 0;
        const lengthFor =
          countRegistryPage.length < 10 ? 1 : countPagesConections;

        let contactOld = {};

        for (let i = 0; i < lengthFor; i++) {
          try {
            const listContactTemp = await this.loadContactConnectionsData(page);
            if (contactOld[0]?.profileName == listContactTemp[0]?.profileName) {
              console.log('contact duplicate', listContactTemp);
              break;
            }

            for (const cntKey in listContactTemp) {
              const info = await this.scrapProfile(
                listContactTemp[cntKey].profileName
              );
              await this.saveContact(listContactTemp[cntKey].profileName, {
                contactMaster,
                ...listContactTemp[cntKey],
                ...info,
              });
            }

            contactOld = listContactTemp[0];
            contacts = [...contacts, ...listContactTemp];

            if (i < lengthFor) {
              try {
                await page.waitForTimeout(600);
                await buttonNextElm.click();

                await page.waitForTimeout(600);
                await this.__autoScroll(page);

                await this.__autoScroll(page);

                // total de conexoes do contato
                buttonNextElm = await page.$(
                  '#main > div > div > div.artdeco-card > div > div .artdeco-pagination__button--next'
                );

                const elements = await page.waitForSelector('#main', {
                  waitUntil: ['load', 'domcontentloaded'],
                  timeout: 0,
                });

                countRegistryPage = await elements.$$eval(
                  'div > div > div > ul.reusable-search__entity-results-list li.reusable-search__result-container span.entity-result__title-text > a.app-aware-link span span[aria-hidden]',
                  (el) => el.map((x) => x.innerText)
                );

                if (!countRegistryPage.length) break;
                await page.waitForTimeout(1000);
                continue;
              } catch (error) {
                console.log('Error', error);
                break;
              }
            }

            break;
          } catch (error) {
            erroCount = +1;
            console.log('trycatch getDataConections::for', error);
            if (erroCount > 5) break;
          }
        }

        this.listContactMaster[key] = {
          ...contactMaster.contacts,
        };

        await page.waitForTimeout(1200);
        page.close();
      }
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `load contact connections had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo a partir da pasta database gerar o arquivo csv formatado.
   *
   * @method generateCSV
   * @return {}
   */
  async generateCSV() {
    try {
      const wb = new xl.Workbook();
      const list = await this.listarArquivosDoDiretorio('./database');
      const ws = wb.addWorksheet('Software...');

      const headingColumnNames = [
        'contactMaster',
        'name',
        'profession',
        'location',
        'href',
        'profileName',
        'firstName',
        'lastName',
        'industryName',
        'geoLocationName',
        'student',
        'entityUrn',
        'headline',
        'summary',
        'occupation',
        'publicIdentifier',
        'trackingId',
        'pictures',
      ];

      const cell = (row, col, value) => {
        let temp = value;
        if (typeof value === 'boolean') {
          temp = String(value);
        } else if (typeof value === 'object') {
          temp = JSON.stringify(value);
        }
        ws.cell(row, col).string(temp);
      };

      headingColumnNames.forEach((heading, column) => {
        cell(1, column + 1, heading);
      });

      list.forEach((record, row) => {
        headingColumnNames.forEach((heading, column) => {
          cell(row + 2, column + 1, record[heading]);
        });
      });

      await wb.write('./exports/ArquivoExcel.xlsx');
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `generateCSV had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como tem como objetivo o autoScroll da página web.
   *
   * @method __autoScroll
   * @param {Object} page Objeto de navegação.
   * @return {page.waitForTimeout} Este método retorna um determinado período e faz o scroll durante o mesmo.
   *
   */
  async __autoScroll(page) {
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        var totalHeight = 0;
        var distance = 100;
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await page.waitForTimeout(500);
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo 'montar' a configuração inicial do webcrawler.
   *
   * @method scrapProfile
   * @param {Object} slug Objeto de configuração
   * @return {JSON} Este método retorna a imagem em um vetor e dois modelos já predeterminado do perfil.
   *
   */
  async scrapProfile(slug) {
    try {
      const url = `${this._scrapeUrl}/${slug}`;
      const response = await fetch(url, {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          cookie: this.accessToken?.cookie,
          'csrf-token': this.accessToken?.token,
        },
      });
      const data = await response.json();

      const dataValue = {
        ...parseObject.parse(modelScrapProfiles, data),
        ...parseObject.parse(modelScrapProfiles, data?.miniProfile),
        pictures: {
          rootUrl:
            data?.miniProfile?.picture['com.linkedin.common.VectorImage']
              .rootUrl,
          values: data?.miniProfile?.picture[
            'com.linkedin.common.VectorImage'
          ].artifacts.map((m) => m.fileIdentifyingUrlPathSegment),
        },
      };

      return dataValue;
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `scrapProfile had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como objetivo 'montar' a configuração inicial do webcrawler.
   *
   * @method listarArquivosDoDiretorio
   * @param {diretorio} diretorio Diretorio dos arquivos gerados.
   * @return {arquivos} Este método retorna uma lista de arquivos em um array.
   *
   */
  async listarArquivosDoDiretorio(diretorio) {
    try {
      let arquivos = [];
      let listaDeArquivos = await fs.readdirSync(diretorio);

      for (let k in listaDeArquivos) {
        let stat = await fs.statSync(diretorio + '/' + listaDeArquivos[k]);
        if (stat.isDirectory())
          await listarArquivosDoDiretorio(
            diretorio + '/' + listaDeArquivos[k],
            arquivos
          );
        else {
          let _return = await fs.readFileSync(
            diretorio + '/' + listaDeArquivos[k],
            { encoding: 'utf8', flag: 'r' }
          );
          arquivos.push(JSON.parse(_return));
        }
      }
      return arquivos;
    } catch (error) {
      return {
        err: true,
        data: {
          error,
          errorMessage: `listarArquivosDoDiretorio had has an error`,
        },
      };
    }
  }

  /**
   * Descrição do método. Este método assíncrono tem como salvar na pasta database as informações do usuário em um arquivo .json.
   *
   * @method saveContact
   * @param {name} String Nome do usuário.
   * @param {value} JSON Conteúdo em JSON.
   * @return {}
   *
   */
  saveContact(name, value) {
    const fileName = `database/${name}.json`
      .replace('\\', '/')
      .replace('-', '');

    fs.writeFile(fileName, JSON.stringify(value, ' ', 4), 'utf8', (err) => {
      if (err)
        console.log(
          'Some error occured - file either not saved or corrupted file saved.'
        );
      else console.log("It's saved!", name);
    });
  }

  /**
   * Descrição do método. Este método assíncrono tem objetivo 'montar' as conexões do usuário.
   *
   * @method loadContactConnectionsData
   * @param {Object} page Objeto de navegação.
   * @return {contacts}   Este método retorna um JSON contendo as conexões do usuário formatado .
   *
   */
  async loadContactConnectionsData(page) {
    await page.waitForTimeout(600);
    // seleciona card da lista inteira de conexoes do contato
    const cardConections = await page.waitForSelector(
      '#main > div > div > div > ul.reusable-search__entity-results-list',
      {
        waitUntil: ['load', 'domcontentloaded'],
        timeout: 0,
      }
    );

    const childContactHref = await cardConections.$$eval(
      'div ul li div > div > div > a.app-aware-link',
      (el) => el.map((x) => x.getAttribute('href').replace(/\?.*/g, ''))
    );

    const childContactName = await cardConections.$$eval(
      'li.reusable-search__result-container span.entity-result__title-text > a.app-aware-link span span[aria-hidden]',
      (el) => el.map((x) => x.innerText)
    );

    const childContactProf = await cardConections.$$eval(
      'li.reusable-search__result-container > div > div > div > div > div > div .entity-result__primary-subtitle',
      (el) => el.map((x) => x.innerText)
    );

    const childContactLocation = await cardConections.$$eval(
      'li.reusable-search__result-container > div > div > div > div > div > div .entity-result__secondary-subtitle',
      (el) => el.map((x) => x.innerText)
    );

    const contacts = [
      ...childContactName.map((d, i) => ({
        name: d,
        profession: childContactProf[i],
        location: childContactLocation[i],
        href: childContactHref[i],
        profileName: childContactHref[i].replace(
          'https://www.linkedin.com/in/',
          ''
        ),
      })),
    ];

    await page.waitForTimeout(600);
    return contacts;
  }

  async loadScrapProfiles() {
    for (const contactMasterkey in this.listContactMaster) {
      try {
        const contactMaster = this.listContactMaster[contactMasterkey];

        for (const contactsKey in contactMaster.contacts) {
          try {
            const contact = contactMaster.contacts[contactsKey];
            const info = await this.scrapProfile(contact.profileName);

            this.listContactMaster[contactMasterkey] = {
              contacts: {
                ...this.listContactMaster[contactsKey].contacts,
                info,
              },
            };
          } catch (error) {
            break;
          }
        }
      } catch (error) {
        console.warn('<= loadScrapProfiles >=', error);
        break;
      }
    }
  }

  async lisfOfFiles(dir) {
    let files_ = [];
    try {
      var files = fs.readdirSync(dir);
      for (var i in files) {
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
          getFiles(name, files_);
        } else {
          files_.push(name);
        }
      }
      return files_;
    } catch (error) {
      console.warn('<= lisfOfFiles >=', error);
      return {
        err: true,
        data: {
          error,
          errorMessage: `LisfOfFiles had has an error`,
        },
      };
    }
  }

  lerArquivo(dir) {
    return new Promise((resolve, reject) => {
      readFile(dir, (err, data) => {
        err ? reject(err) : resolve(data);
      });
    });
  }

  toCSV(data) {
    try {
      if (Array.isArray(data)) {
        const filename = uuid.v4() + '.csv';

        for (let index = 0; index < data.length; index++) {
          let writer = fs.createWriteStream(
            './exports/' + `${data[i].profileName}_${filename}`
          );
          writer.write(JSON.stringify(data[i], ' ', 4), 'utf8');
        }
      }
    } catch (error) {
      console.warn('<= toCSV >=', error);
      return {
        err: true,
        data: {
          error,
          errorMessage: `toCSV had has an error`,
        },
      };
    }
  }

  readFile(readDirectory) {
    console.warn(readDirectory, 1);

    return new Promise((res, rej) => {
      console.warn(readDirectory, 3);

      readFile(readDirectory, (err, data) /* callback */ => {
        console.log(readDirectory, 4, err ? 'Error' : 'Sucess');
        err ? rej(err) : res(data);
      });
    });
  }

  /**
   * Descrição do método. Este método assíncrono tem objetivo executar o projeto.
   *
   * @method loadContactConnectionsData
   * @element init()
   * @element login()
   * @element getCookies()
   * @element processCookies()
   * @element generateTokens()
   * @element loadDataMaster()
   * @element loadContactConnections()
   * @element generateCSV()
   * @return {}
   *
   */
  async execute() {
    console.info('\n The software has been started!');

    await this.init();
    await this.login();
    await this.getCookies();
    await this.processCookies();
    await this.generateTokens();
    await this.loadDataMaster();
    await this.loadContactConnections();
    await this.generateCSV();

    console.info('\n Isso é tudo, pessoal!');
  }
}
const LG = process.env.USER_LOG;
const PW = process.env.USER_PASS;
return new Scrapper(LG, PW).execute();
