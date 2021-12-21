const { colours } = require('../json/index');

module.exports.removeDuplicates = async function (data) {
  return Array.from(
    data.filter((value, index) => data.indexOf(value) === index)
  );
};

module.exports.quantityOfTags = async function (pag) {
  const regex = /\<([^\>]+)\>/g;
  let tes = await pag.evaluate((el) => el.innerHTML);

  let i = 0;
  do {
    i++;
  } while (regex.test(tes));
  return i;
};

module.exports.autoScroll = async function (page) {
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
};

module.exports.logWarn = (res) => {
  if (process.env.DEBUG == 'true')
    console.log(colours.fg.yellow, JSON.stringify(res, ' ', 4), colours.reset);
};

module.exports.logInfo = (res) => {
  if (process.env.DEBUG == 'true')
    console.log(colours.fg.cyan, JSON.stringify(res, ' ', 4), colours.reset);
};

module.exports.logRed = (res) => {
  if (process.env.DEBUG == 'true')
    console.log(colours.fg.red, JSON.stringify(res, ' ', 4), colours.reset);
};
