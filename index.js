const compass = require('cardinal-direction');
const { utcToZonedTime, format } = require('date-fns-tz');
const fs = require('fs-extra');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;
let request = require('request');

if (!argv.key) {
    console.error('No API key defined (example: "--key=YOUR_API_KEY")');
    return;
}

if (!argv.city) {
    console.error('No City defined (example: "--city=Portsmouth")');
    return;
}

if (!argv.region) {
    console.error('No Region defined (example: "--region=Europe/London")');
    return;
}

if (!argv.output) {
    console.error('No Output file path defined (example: "--output=/path/to/weather.txt")');
    return;
}

let apiKey = argv.key;
let city = argv.city;
let url = `http://api.openweathermap.org/data/2.5/weather?units=metric&q=${city}&appid=${apiKey}`

request(url, function (error, response, body) {
    if (error){
        console.error(error);
    } else {
        let weather = JSON.parse(body);

        var text = '',
            windSpeed = 0,
            windDirection = 'n/a',
            windGust = 0,
            rain1 = 0,
            rain3 = 0;

        if (weather.wind) {
            windSpeed = weather.wind.speed;
            windDirection = weather.wind.deg;

            if (weather.wind.gust) {
                windGust = weather.wind.gust;
            }
        }

        if (weather.rain) {
            rain1 = weather.rain["1h"].toFixed(1);
            rain3 = weather.rain["3h"].toFixed(1);
        }

        let sunriseUtc = new Date(weather.sys.sunrise * 1000);
        let sunriseLocal = utcToZonedTime(sunriseUtc, argv.region);
        let sunsetUtc = new Date(weather.sys.sunset * 1000);
        let sunsetLocal = utcToZonedTime(sunsetUtc, argv.region);

        text += `Outside Temperature: ${weather.main.temp.toFixed(1)}C \n`;
        text += `Feels Like: ${weather.main.feels_like.toFixed(1)}C\n`;
        text += `Humidity: ${weather.main.humidity}%\n`;
        text += `Visibility: ${weather.visibility / 1000} km\n`;
        text += `Wind Speed: ${(windSpeed * 3.6).toFixed(0)} km/h\n`;
        text += `Wind Direction: ${compass.cardinalFromDegree(windDirection)}\n`;
        text += `Wind Gust: ${(windGust * 3.6).toFixed(0)} km/h\n`;
        text += `Rain (Last 1 Hour): ${rain1} mm\n`;
        text += `Rain (Last 3 Hours): ${rain3} mm\n`;
        text += `Sunrise: ${format(sunriseLocal, 'HH:mm', { timeZone: argv.region })}\n`;
        text += `Sunset: ${format(sunsetLocal, 'HH:mm', { timeZone: argv.region })}\n`;

        fs.outputFileSync(argv.output, text);
    }
});