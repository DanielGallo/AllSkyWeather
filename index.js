const compass = require('cardinal-direction');
const { utcToZonedTime, format } = require('date-fns-tz');
const fs =  require('fs');
const fsExtra = require('fs-extra');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const sensor = require('node-dht-sensor').promises;
const { exec } = require('promisify-child-process');
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
let url = `http://api.openweathermap.org/data/2.5/weather?units=metric&q=${city}&appid=${apiKey}`;

sensor.setMaxRetries(60);

const Devices = {
    DEW_HEATER: 0x01,
    FAN: 0x04
};

function setDeviceState(device, state) {
    let power = 0x00;

    if (state === 'on') {
        power = 0xFF;
    }

    let command = `sudo i2cset -y 1 0x11 ${device} ${power}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(`setDeviceState error: ${error.message}`);
        }

        if (stderr) {
            console.log(`setDeviceState stderr: ${stderr}`);
        }
    });
}

async function getDeviceState(device) {
    let command = `sudo i2cget -y 1 0x11 ${device}`;
    let state = 'Off';

    const { stdout, stderr } = await exec(command);

    if (stderr) {
        console.log(`getDeviceState stderr: ${stderr}`);
    }

    console.log(`getDeviceState stdout: ${stdout}`);

    if (stdout.replace(/[\r\n]/gm, '').toLowerCase().trim() === '0xff') {
        state = 'On';
    }

    return state;
}

(async() => {
    let cpuTemp = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp');
    let cpuTemperature = cpuTemp / 1000;
    let fanState = '';

    // Turn on the case fan if the CPU temperature goes above this threshold
    if (cpuTemperature > 57) {
        setDeviceState(Devices.FAN, 'on');
        fanState = 'On';
    } else {
        setDeviceState(Devices.FAN, 'off');
        fanState = 'Off';
    }

    // Get the dew heater state
    let dewHeaterState = await getDeviceState(Devices.DEW_HEATER);

    // Get the temperature and humidity of the AllSky Camera enclosure (separate sensor)
    let temperatureSensor = await sensor.read(22, 0);

    request(url, function (error, response, body) {
        if (error){
            console.error(error);
        } else {
            let weather = JSON.parse(body);

            let text = '',
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
                if (weather.rain["1h"]) {
                    rain1 = weather.rain["1h"].toFixed(1);
                }

                if (weather.rain["3h"]) {
                    rain3 = weather.rain["3h"].toFixed(1);
                }
            }

            let sunriseUtc = new Date(weather.sys.sunrise * 1000);
            let sunriseLocal = utcToZonedTime(sunriseUtc, argv.region);
            let sunsetUtc = new Date(weather.sys.sunset * 1000);
            let sunsetLocal = utcToZonedTime(sunsetUtc, argv.region);

            // Include a display-friendly location name if specified as an extra argument
            if (argv.location) {
                text += `Location: ${argv.location}\n`;
            }

            text += `Outside Temperature: ${weather.main.temp.toFixed(1)}C\n`;
            text += `Outside Humidity: ${weather.main.humidity}%\n`;

            if (temperatureSensor
                && temperatureSensor.temperature !== null
                && temperatureSensor.temperature !== undefined) {
                text += `Case Temperature: ${temperatureSensor.temperature.toFixed(1)}C\n`;
                text += `Case Humidity: ${temperatureSensor.humidity.toFixed(0)}%\n`;
            }

            text += `Case Fan: ${fanState}\n`;
            text += `Dew Heater: ${dewHeaterState}\n`;

            text += `CPU Temperature: ${cpuTemperature.toFixed(1)}C\n`;
            text += `Pressure: ${weather.main.pressure} hPa\n`;
            text += `Visibility: ${weather.visibility / 1000} km\n`;
            text += `Wind Speed: ${(windSpeed * 3.6).toFixed(0)} km/h\n`;
            text += `Wind Direction: ${compass.cardinalFromDegree(windDirection, compass.CardinalSubset.Intercardinal)}\n`;
            text += `Wind Gust: ${(windGust * 3.6).toFixed(0)} km/h\n`;
            text += `Rain (Last 1 Hour): ${rain1} mm\n`;
            text += `Rain (Last 3 Hours): ${rain3} mm\n`;
            text += `Sunrise: ${format(sunriseLocal, 'HH:mm', { timeZone: argv.region })}\n`;
            text += `Sunset: ${format(sunsetLocal, 'HH:mm', { timeZone: argv.region })}\n`;

            fsExtra.outputFileSync(argv.output, text);
        }
    });
})();