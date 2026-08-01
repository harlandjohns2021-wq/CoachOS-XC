(() => {
  'use strict';

  const ACTIVE_KEY = 'coachos_xc_v2';
  const DEFAULT_YEAR = '2025';

  function parseRows(group, rows, defaults = {}) {
    return rows.trim().split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [name, time = '', meet = defaults.meet || '', source = defaults.source || 'MileSplit', current = '', confidence = ''] = line.split('|').map((part) => part.trim());
      return { name, group, time, meet, source, current, confidence, status: time ? 'Result' : 'Entry' };
    });
  }

  const seasons = {
    '2025': {
      note: 'Reconstructed from the 2025 Harts Bluff HS results and JH entry list. An entry confirms rostered meet participation, not necessarily a finish.',
      sources: [
        ['Texas MileSplit • Harts Bluff HS results', 'https://tx.milesplit.com/meets/639401-harts-bluff-hs-invitational-2025/results/1203956/raw'],
        ['Texas MileSplit • Harts Bluff JH entries', 'https://tx.milesplit.com/meets/639403-harts-bluff-jh-invitational-2025/entries']
      ],
      roster: [
        ...parseRows('HS Girls', `
Mila Mendoza|14:54.95|Harts Bluff HS Invitational|MileSplit
Yaretzi Prado|15:12.26|Harts Bluff HS Invitational|MileSplit|Yaretzi Prado|exact
Daena Salazar|15:31.58|Harts Bluff HS Invitational|MileSplit|Daena Salazar|exact
Brianna Porras|16:00.12|Harts Bluff HS Invitational|MileSplit
Molly Bloomer|16:23.13|Harts Bluff HS Invitational|MileSplit|Molly Bloomer|exact
Paisley Bloomer|16:36.60|Harts Bluff HS Invitational|MileSplit|Paisley Bloomer|exact
Tilley Green|17:12.88|Harts Bluff HS Invitational|MileSplit
Katherine Osorto|15:52.90|Harts Bluff HS Invitational JV|MileSplit|Katherine Orsorto|likely
Saray Prado|17:42.73|Harts Bluff HS Invitational JV|MileSplit
Sonia Hernadez|18:21.61|Harts Bluff HS Invitational JV|MileSplit
Esmerlda Gusman|19:07.70|Harts Bluff HS Invitational JV|MileSplit
Elisa Zuniga|20:36.21|Harts Bluff HS Invitational JV|MileSplit
Sareth Rosales||Harts Bluff HS Invitational|MileSplit
Delainy Torres||Harts Bluff HS Invitational|MileSplit|Delainy Torres|exact
        `),
        ...parseRows('HS Boys', `
Anthony Hernandez|19:45.39|Harts Bluff HS Invitational|MileSplit|Tony Hernandez|likely
Gerrado Hernadez|22:17.75|Harts Bluff HS Invitational|MileSplit|Gerardo Hernandez|likely
Christopher Jimenez|22:29.80|Harts Bluff HS Invitational|MileSplit|Chris Jimnez|likely
Aaron Klump|26:42.61|Harts Bluff HS Invitational|MileSplit|Aaron Klump|exact
Rafael Flores||Harts Bluff HS Invitational|MileSplit
Eliseo Hernandez||Harts Bluff HS Invitational|MileSplit
Cesar Pastor||Harts Bluff HS Invitational|MileSplit
        `),
        ...parseRows('JH Boys', `
Roosben Mendoza||Harts Bluff JH Invitational|MileSplit
Lukas Marshall||Harts Bluff JH Invitational|MileSplit|Lukas Marshall|exact
Juan Hernandez||Harts Bluff JH Invitational|MileSplit
Aiden Green|15:34.00|2025 MileSplit profile PR|MileSplit|Aiden Green|exact
Abel Green||Harts Bluff JH Invitational|MileSplit|Abel Green|exact
Ivan Olvera||Harts Bluff JH Invitational|MileSplit|Ivan Olvera|exact
Issac Ates||Harts Bluff JH Invitational|MileSplit|Isaac Ates|likely
Paul Reyes||Harts Bluff JH Invitational|MileSplit
Julian Wario||Harts Bluff JH Invitational|MileSplit|Julian Wario|exact
Jesus Cordova||Harts Bluff JH Invitational|MileSplit|Jesus Cordova|exact
Connor Shumate||Harts Bluff JH Invitational|MileSplit|Conner Shumate|likely
Julian Garcia||Harts Bluff JH Invitational|MileSplit|Julian Garcia|exact
        `),
        ...parseRows('JH Girls', `
Cynthia Hernandez||Harts Bluff JH Invitational|MileSplit|Cynthia Hernandez|exact
Nicole Hernandez||Harts Bluff JH Invitational|MileSplit|Nicole Hernandez|exact
Makaleh Segura||Harts Bluff JH Invitational|MileSplit|McKaelah Segura|likely
Lia Ayala||Harts Bluff JH Invitational|MileSplit|Lia Ayala|exact
Angelique Santos||Harts Bluff JH Invitational|MileSplit
Dariela Guerrero||Harts Bluff JH Invitational|MileSplit
Claire Scoggins|15:15.40|Harts Bluff JH Invitational entry seed|MileSplit|Claire Scoggins|exact
Bianca Aquilar|16:33.50|Harts Bluff JH Invitational entry seed|MileSplit|Bianca Aguilar|likely
Jackeline Arrellano|18:48.02|Harts Bluff JH Invitational entry seed|MileSplit|Jackie Arellano|likely
        `)
      ]
    },

    '2024': {
      note: 'Roster is the union of athletes found in public 2024 varsity, JV and Harts Bluff invitational records.',
      sources: [
        ['Texas MileSplit • Race at the Lake team results', 'https://tx.milesplit.com/meets/605467-ken-gaston-race-at-the-lake-invitational-cross-country-meet-2024/teams/34936'],
        ['Texas MileSplit • Titus County Fair JV girls', 'https://tx.milesplit.com/meets/640835-mt-pleasant-titus-county-fair-invitational-2024/results/1085848/raw'],
        ['Texas MileSplit • Titus County Fair JV boys', 'https://tx.milesplit.com/meets/640835-mt-pleasant-titus-county-fair-invitational-2024/results/1085847/raw']
      ],
      roster: [
        ...parseRows('HS Girls', `
Alexa Arzate|12:17.70|Race at the Lake|MileSplit
Perla Solorio|13:27.60|Race at the Lake|MileSplit
Paisley Bloomer|14:21.80|Race at the Lake|MileSplit|Paisley Bloomer|exact
Sonia Hernadez|14:41.60|Race at the Lake|MileSplit
Yaretzi Prado|14:51.40|Race at the Lake|MileSplit|Yaretzi Prado|exact
Araceli Olvera|15:02.30|Race at the Lake|MileSplit
Brianna Porras|15:13.40|Race at the Lake|MileSplit
Esmerlda Gusman|15:18.20|Race at the Lake|MileSplit
Saray Prado|15:54.60|Race at the Lake|MileSplit
Molly Bloomer|16:07.60|Race at the Lake|MileSplit|Molly Bloomer|exact
Tilley Green|15:45.80|Titus County Fair JV|MileSplit
Jaci Caplinger|15:47.60|Titus County Fair JV|MileSplit
Mila Mendoza|16:27.90|Titus County Fair JV|MileSplit
Eden Arzate|18:16.30|Titus County Fair JV|MileSplit
Jali Caplinger|18:20.50|Titus County Fair JV|MileSplit
Isabella Morrow|20:04.00|Titus County Fair JV|MileSplit
Sareth Rosales|20:51.10|Titus County Fair JV|MileSplit
        `),
        ...parseRows('HS Boys', `
Jose Garcia|17:39.70|Race at the Lake|MileSplit
Johnathan Diaz|17:53.60|Race at the Lake|MileSplit
Jaycob Calixto|20:29.30|Race at the Lake|MileSplit
Robdy Ayala|21:29.00|Race at the Lake|MileSplit
Anthony Hernandez|21:53.30|Race at the Lake|MileSplit|Tony Hernandez|likely
Ethan Ortega|22:46.70|Race at the Lake|MileSplit
Carlos Martinez|23:58.60|Titus County Fair JV|MileSplit
Rolian Salazar|24:33.20|Titus County Fair JV|MileSplit
Gerrado Hernadez|25:13.80|Titus County Fair JV|MileSplit|Gerardo Hernandez|likely
Jarrod Castanon|25:15.50|Titus County Fair JV|MileSplit
Christopher Jimenez|26:08.50|Titus County Fair JV|MileSplit|Chris Jimnez|likely
        `),
        ...parseRows('JH Girls', `
Angelyn Le||Harts Bluff Invitational entry|MileSplit
Delainy Torres||Harts Bluff Invitational entry|MileSplit|Delainy Torres|exact
Angelique Le||Harts Bluff Invitational entry|MileSplit
Bianca Aquilar||Harts Bluff Invitational entry|MileSplit|Bianca Aguilar|likely
Malozie Mccraw||Harts Bluff Invitational entry|MileSplit
Jackeline Arrellano||Harts Bluff Invitational entry|MileSplit|Jackie Arellano|likely
Daena Salazar||Harts Bluff Invitational entry|MileSplit|Daena Salazar|exact
        `),
        ...parseRows('JH Boys', `
Aaron Klump||Harts Bluff Invitational entry|MileSplit|Aaron Klump|exact
Anthony Hernandez||Harts Bluff Invitational entry|MileSplit|Tony Hernandez|likely
Gerrado Hernadez||Harts Bluff Invitational entry|MileSplit|Gerardo Hernandez|likely
Christopher Jimenez||Harts Bluff Invitational entry|MileSplit|Chris Jimnez|likely
        `)
      ]
    },

    '2023': {
      note: 'Union of Harts Bluff athletes found in the Texas A&M-Texarkana, Titus County Fair and Race at the Lake public records.',
      sources: [
        ['Texas MileSplit • Texas A&M-Texarkana entries', 'https://tx.milesplit.com/meets/561172-texas-aandm-texarkana-texas-high-school-xc-invitational-2023/entries'],
        ['Texas MileSplit • Titus County Fair MS results', 'https://tx.milesplit.com/meets/562287-mount-pleasant-titus-county-fair-invitational-2023/results/968629/raw'],
        ['Texas MileSplit • Race at the Lake results', 'https://tx.milesplit.com/meets/508449-ken-gaston-race-at-the-lake-invitational-cross-country-meet-2023/results/967955/raw']
      ],
      roster: [
        ...parseRows('HS Girls', `
Alexa Arzate|12:58.72|Texas A&M-Texarkana|MileSplit
Perla Solorio|13:16.68|Texas A&M-Texarkana|MileSplit
Paislee Marshall|14:46.70|Texas A&M-Texarkana|MileSplit
Mila Mendoza|15:00.00|Texas A&M-Texarkana|MileSplit
Araceli Olvera|15:29.06|Texas A&M-Texarkana|MileSplit
Isabella Morrow|15:58.95|Texas A&M-Texarkana|MileSplit
Jaci Caplinger|16:02.70|Texas A&M-Texarkana|MileSplit
Saray Prado|16:47.00|Texas A&M-Texarkana|MileSplit
Kaylee Monroe|17:00.20|Texas A&M-Texarkana|MileSplit
Judith Reyes|18:18.80|Texas A&M-Texarkana|MileSplit
Allyson Monroe|20:09.01|Texas A&M-Texarkana|MileSplit
Paisley Bloomer|20:13.80|Texas A&M-Texarkana|MileSplit|Paisley Bloomer|exact
Elisa Zuniga|21:16.50|Texas A&M-Texarkana|MileSplit
Nataly Zuniga|22:15.20|Texas A&M-Texarkana JV|MileSplit
Norlin Hercules||Texas A&M-Texarkana entry|MileSplit
Jali Caplinger||Texas A&M-Texarkana entry|MileSplit
Judith Soto||Texas A&M-Texarkana entry|MileSplit
Nira Cubero|19:42.40|Texas A&M-Texarkana JV|MileSplit
        `),
        ...parseRows('HS Boys', `
Eliseo Hernandez||Texas A&M-Texarkana entry|MileSplit
Jose Garcia|16:50.78|Texas A&M-Texarkana entry seed|MileSplit
Jacob Calixto|19:34.10|Texas A&M-Texarkana entry seed|MileSplit
Tristan Olvera|20:28.17|Texas A&M-Texarkana entry seed|MileSplit
Irving Campos|20:43.91|Texas A&M-Texarkana entry seed|MileSplit
Ethan Ortega|24:30.52|Texas A&M-Texarkana entry seed|MileSplit
Gerrado Hernadez|25:38.78|Texas A&M-Texarkana entry seed|MileSplit|Gerardo Hernandez|likely
Bryan Valdez|35:03.77|Texas A&M-Texarkana entry seed|MileSplit
David Lopez|23:44.50|Race at the Lake|MileSplit
Anthony Hernandez|24:12.70|Race at the Lake|MileSplit|Tony Hernandez|likely
        `),
        ...parseRows('JH Boys', `
Robdy Ayala|14:14.70|Titus County Fair MS|MileSplit
Marcos Ramirez|14:30.40|Titus County Fair MS|MileSplit
Brendan Minifee|18:16.60|Titus County Fair MS|MileSplit
Aaron Klump|18:29.20|Titus County Fair MS|MileSplit|Aaron Klump|exact
        `)
      ]
    },

    '2022': {
      note: 'Roster reconstructed from the 2022 Harts Bluff Invitational entry list. Times shown are representative public results when available.',
      sources: [
        ['Texas MileSplit • Harts Bluff Invitational entries', 'https://tx.milesplit.com/meets/486951-harts-bluff-invitational-2022/entries'],
        ['Texas MileSplit • Titus County Fair results', 'https://tx.milesplit.com/meets/484903-mount-pleasant-titus-county-fair-invitational-2022/results']
      ],
      roster: [
        ...parseRows('HS Girls', `
Jaci Caplinger||Harts Bluff Invitational entry|MileSplit
Saray Prado||Harts Bluff Invitational entry|MileSplit
Perla Solorio||Harts Bluff Invitational entry|MileSplit
Alexa Arzate||Harts Bluff Invitational entry|MileSplit
Anay Solorio||Harts Bluff Invitational entry|MileSplit
Araceli Olvera||Harts Bluff Invitational entry|MileSplit
Liz Campos||Harts Bluff Invitational entry|MileSplit
Paislee Marshall||Harts Bluff Invitational entry|MileSplit
Izzy Morrow||Harts Bluff Invitational entry|MileSplit
Kaitlyn Blake||Harts Bluff Invitational entry|MileSplit
Kaitley Green||Harts Bluff Invitational entry|MileSplit
Alma Ulayyet||Harts Bluff Invitational entry|MileSplit
        `),
        ...parseRows('HS Boys', `
Prestyn Joyner||Harts Bluff Invitational entry|MileSplit
Aldo Aquillar||Harts Bluff Invitational entry|MileSplit
Ryker Hamblin||Harts Bluff Invitational entry|MileSplit
Jayden Morales||Harts Bluff Invitational entry|MileSplit
Luke Inman||Harts Bluff Invitational entry|MileSplit
Seth Clark|19:51.10|Titus County Fair JV|MileSplit
Cameron Erwin||Harts Bluff Invitational entry|MileSplit
Onely Ashton||Harts Bluff Invitational entry|MileSplit
Matthew Rowland||Harts Bluff Invitational entry|MileSplit
Jayden Castanon||Harts Bluff Invitational entry|MileSplit
Irving Campos||Harts Bluff Invitational entry|MileSplit
Jacob Calixto||Harts Bluff Invitational entry|MileSplit
Tristan Olvera||Harts Bluff Invitational entry|MileSplit
        `),
        ...parseRows('JH Boys', `
Abraham Perez||Harts Bluff Invitational entry|MileSplit
Robdy Ayala||Harts Bluff Invitational entry|MileSplit
Marcos Ramirez||Harts Bluff Invitational entry|MileSplit
Christopher Jimenez||Harts Bluff Invitational entry|MileSplit|Chris Jimnez|likely
Raphael Flores||Harts Bluff Invitational entry|MileSplit
Jarrod Castanon||Harts Bluff Invitational entry|MileSplit
Yonathan Bocanegra||Harts Bluff Invitational entry|MileSplit
Anthony Hernandez||Harts Bluff Invitational entry|MileSplit|Tony Hernandez|likely
        `),
        ...parseRows('JH Girls', `
Sonia Hernadez||Harts Bluff Invitational entry|MileSplit
Elisa Zuniga||Harts Bluff Invitational entry|MileSplit
Madison Mckelvy||Harts Bluff Invitational entry|MileSplit
Melany Jimenez||Harts Bluff Invitational entry|MileSplit
Brianna Porras||Harts Bluff Invitational entry|MileSplit
Sophia Rodriquez||Harts Bluff Invitational entry|MileSplit
Mila Mendoza||Harts Bluff Invitational entry|MileSplit
Adira Wario||Harts Bluff Invitational entry|MileSplit
Kaylee Monroe||Harts Bluff Invitational entry|MileSplit
Giselle Arellano||Harts Bluff Invitational entry|MileSplit
Kelly Camarillo||Harts Bluff Invitational entry|MileSplit
        `)
      ]
    },

    '2021': {
      note: 'Harts Bluff team results from the 2021 Mount Pleasant Titus County Fair Invitational.',
      sources: [
        ['Texas MileSplit • Harts Bluff team results', 'https://tx.milesplit.com/meets/424123-mount-pleasant-titus-county-fair-invitational-2021/teams/34936?sort=event'],
        ['Athletic.net • Texas 2021 middle-school statistics', 'https://www.athletic.net/cross-country/division/61959']
      ],
      roster: [
        ...parseRows('Girls', `
Perla Solorio|13:26.20|Titus County Fair|MileSplit
Alexa Arzate|14:19.60|Titus County Fair|MileSplit
Mila Mendoza|15:00.00|Titus County Fair|MileSplit
Anay Solorio|15:28.20|Titus County Fair|MileSplit
Araceli Olvera|15:38.80|Titus County Fair|MileSplit
Adira Wario|15:53.90|Titus County Fair|MileSplit
Liz Campos|15:59.70|Titus County Fair|MileSplit
Paislee Marshall|16:02.70|Titus County Fair|MileSplit
Izzy Morrow|16:20.70|Titus County Fair|MileSplit
Kaitlyn Blake|16:33.10|Titus County Fair|MileSplit
Kaylee Monroe|17:00.20|Titus County Fair|MileSplit
Kaitley Green|17:36.70|Titus County Fair|MileSplit
Judith Reyes|18:18.80|Titus County Fair|MileSplit
Giselle Arellano|18:32.10|Titus County Fair|MileSplit
Kayliegh Martin|18:49.80|Titus County Fair|MileSplit
Aynsli Carrington|18:56.20|Titus County Fair|MileSplit
Elizabeth Wisinger|18:58.40|Titus County Fair|MileSplit
Kelly Camarillo|19:58.70|Titus County Fair|MileSplit
Paisley Bloomer|20:13.80|Titus County Fair|MileSplit|Paisley Bloomer|exact
Abbi Hinton|21:20.40|Titus County Fair|MileSplit
Molly Bloomer|22:14.20|Titus County Fair|MileSplit|Molly Bloomer|exact
        `),
        ...parseRows('JH Boys', `
Noah Hernandez|12:26.80|Titus County Fair|MileSplit
Jayden Morales|12:51.50|Titus County Fair|MileSplit
Brayden Craddock|13:16.90|Titus County Fair|MileSplit
Irving Campos|13:22.10|Titus County Fair|MileSplit
Luke Inman|13:31.60|Titus County Fair|MileSplit
Hazel Alvarez|13:57.20|Titus County Fair|MileSplit
Eric Saucedo|14:20.60|Titus County Fair|MileSplit
Raphael Flores|14:21.50|Titus County Fair|MileSplit
Kaden Mason|14:34.70|Titus County Fair|MileSplit
Jarrod Castanon|15:58.00|Titus County Fair|MileSplit
Yonathan Bocanegra|16:27.00|Titus County Fair|MileSplit
Ethan Ortega|17:04.40|Titus County Fair|MileSplit
Anthony Hernandez|17:04.80|Titus County Fair|MileSplit|Tony Hernandez|likely
Gerrado Hernadez|17:24.20|Titus County Fair|MileSplit|Gerardo Hernandez|likely
Noah Carr|18:21.70|Titus County Fair|MileSplit
Carlos Martinez|19:01.90|Titus County Fair|MileSplit
        `),
        ...parseRows('HS Boys', `
Ryker Hamblin|18:14.80|Titus County Fair|MileSplit
Jose Garcia|19:52.50|Titus County Fair|MileSplit
Avyn Carrinington|19:53.90|Titus County Fair|MileSplit
Jacob Lilly|20:14.60|Titus County Fair|MileSplit
Matthew Rowland|21:25.80|Titus County Fair|MileSplit
Prestyn Joyner|21:47.30|Titus County Fair|MileSplit
Michael Dodson|21:49.70|Titus County Fair|MileSplit
Jaycob Calixto|22:18.80|Titus County Fair|MileSplit
        `)
      ]
    },

    '2020': {
      note: 'Public 2020 meet entries and results. Athletic.net independently mirrors the same official team scores and marks for the Titus County Fair meet.',
      sources: [
        ['Texas MileSplit • Titus County Fair middle-school results', 'https://tx.milesplit.com/meets/388768-mount-pleasant-titus-county-fair-invitational-2020/results/705127/raw'],
        ['Texas MileSplit • Titus County Fair entries', 'https://tx.milesplit.com/meets/388768-mount-pleasant-titus-county-fair-invitational-2020/entries'],
        ['Athletic.net • Titus County Fair results', 'https://www.athletic.net/CrossCountry/Results/Meet.aspx?Meet=181406&show=all']
      ],
      roster: [
        ...parseRows('JH Boys', `
Ryker Hamblin|12:17.34|Titus County Fair|MileSplit / Athletic.net
Tristan Olvera|13:31.19|Titus County Fair|MileSplit / Athletic.net
Jayden Morales|14:11.66|Titus County Fair|MileSplit / Athletic.net
Jaden Segura|14:42.59|Titus County Fair|MileSplit / Athletic.net
Hazel Morales|16:17.80|Titus County Fair|MileSplit / Athletic.net
Chris Ruvalcaba|16:54.89|Titus County Fair|MileSplit / Athletic.net
Jose Garcia||Titus County Fair entry|MileSplit
Jaycob Calixto||Titus County Fair entry|MileSplit
Bryan Hernandez||Titus County Fair entry|MileSplit
Fabritzzio Sanchez||Titus County Fair entry|MileSplit
        `),
        ...parseRows('JH Girls', `
Perla Solorio|15:16.14|Titus County Fair|MileSplit / Athletic.net
Miyah Amador|15:56.01|Titus County Fair|MileSplit / Athletic.net
San Juana Arellano|18:37.67|Titus County Fair|MileSplit / Athletic.net
Alma Ulayyet|20:10.95|Titus County Fair|MileSplit / Athletic.net
Lainee Cameron|21:24.73|Titus County Fair|MileSplit / Athletic.net
        `)
      ]
    },

    '2019': {
      note: 'Harts Bluff athletes with published results at the 2019 Mount Pleasant Titus County Fair Invitational.',
      sources: [
        ['Texas MileSplit • Harts Bluff team results', 'https://tx.milesplit.com/meets/370182-mt-pleasant-titus-county-fair-cross-country-invitational-2019/teams/34936'],
        ['Athletic.net • Texas UIL historical index', 'https://www.athletic.net/cross-country/division/75264']
      ],
      roster: [
        ...parseRows('JH Girls', `
Kelsey Howard|17:57.24|Titus County Fair|MileSplit
Sophia Miranda|19:32.63|Titus County Fair|MileSplit
Allyson Monroe|20:09.01|Titus County Fair|MileSplit
Elizabeth Wisinger|20:29.98|Titus County Fair|MileSplit
Araceli Olvera|20:30.91|Titus County Fair|MileSplit
Avanleigh Thomas|21:06.96|Titus County Fair|MileSplit
        `),
        ...parseRows('JH Boys', `
Jose Garcia|13:11.88|Titus County Fair|MileSplit
Seth Clark|13:15.71|Titus County Fair|MileSplit
Isaac Anguiano|13:49.38|Titus County Fair|MileSplit
Jaycob Calixto|14:05.83|Titus County Fair|MileSplit
Bryan Hernandez|14:10.64|Titus County Fair|MileSplit
Fabritzzio Sanchez|14:37.11|Titus County Fair|MileSplit
Dylan Olvera|15:09.49|Titus County Fair|MileSplit
Layken Adair|15:23.80|Titus County Fair|MileSplit
Theron Tigert|16:07.55|Titus County Fair|MileSplit
Aiden Burgess|17:38.29|Titus County Fair|MileSplit
Cameron Ervin|18:01.38|Titus County Fair|MileSplit
Tristan Olvera|18:47.52|Titus County Fair|MileSplit
Matthew Rowland|19:58.75|Titus County Fair|MileSplit
Andy Chavarria|25:08.10|Titus County Fair|MileSplit
        `)
      ]
    }
  };

  let selectedYear = DEFAULT_YEAR;
  let selectedGroup = 'All';
  let currentOnly = false;
  let query = '';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function activeRosterNames() {
    try {
      const state = JSON.parse(localStorage.getItem(ACTIVE_KEY)) || {};
      return (state.athletes || []).filter((athlete) => athlete.active !== false).map((athlete) => athlete.name);
    } catch {
      return [];
    }
  }

  function injectStyles() {
    if (document.getElementById('pastSeasonsStyles')) return;
    const style = document.createElement('style');
    style.id = 'pastSeasonsStyles';
    style.textContent = `
      .past-season-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
      .past-season-tab{border:1px solid #d8deea;background:#fff;color:#0b1739;border-radius:999px;padding:8px 14px;font-weight:800;cursor:pointer}
      .past-season-tab.active{background:#0b1739;color:#fff;border-color:#0b1739}
      .past-season-filters{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
      .past-source-links{display:flex;gap:8px;flex-wrap:wrap}
      .past-source-link{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#f4f6fa;color:#0b1739;text-decoration:none;font-size:12px;font-weight:800}
      .past-match-exact{background:#e8f7ee;color:#11633a}
      .past-match-likely{background:#fff4d8;color:#7b5100}
      .past-roster-table td,.past-roster-table th{white-space:nowrap}
      .past-roster-table td:nth-child(1),.past-roster-table th:nth-child(1){white-space:normal}
      .past-season-note{line-height:1.55}
      @media(max-width:720px){
        .past-season-filters{grid-template-columns:1fr}
        .past-roster-table{min-width:780px}
        .mobile-nav button[data-past-seasons-nav]{font-size:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function injectNavigation() {
    if (!document.querySelector('[data-past-seasons-nav]')) {
      const sidebar = document.querySelector('.sidebar .nav');
      const settings = sidebar?.querySelector('[data-view="settings"]');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = 'pastSeasons';
      button.dataset.pastSeasonsNav = 'true';
      button.innerHTML = '<span class="nav-ico">◫</span>Past Seasons';
      if (sidebar) sidebar.insertBefore(button, settings || null);
    }

    if (!document.querySelector('.mobile-nav [data-past-seasons-nav]')) {
      const mobile = document.querySelector('.mobile-nav');
      if (mobile) {
        mobile.style.gridTemplateColumns = 'repeat(6,minmax(0,1fr))';
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.view = 'pastSeasons';
        button.dataset.pastSeasonsNav = 'true';
        button.innerHTML = '<span>◫</span>History';
        mobile.appendChild(button);
      }
    }

    if (!document.getElementById('openPastSeasonsBtn')) {
      const timingToolbar = document.querySelector('#timing .section-title .toolbar');
      if (timingToolbar) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'openPastSeasonsBtn';
        button.className = 'secondary';
        button.textContent = 'Past seasons';
        timingToolbar.appendChild(button);
      }
    }
  }

  function injectView() {
    if (document.getElementById('pastSeasons')) return;
    const settings = document.getElementById('settings');
    const section = document.createElement('section');
    section.id = 'pastSeasons';
    section.className = 'view';
    section.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Past Seasons</h2>
          <p>Historical Harts Bluff cross-country rosters and published meet records, kept separate from the active 2026 season.</p>
        </div>
      </div>
      <div id="pastSeasonTabs" class="past-season-tabs"></div>
      <div class="grid-3" id="pastSeasonKpis"></div>
      <div class="card">
        <div class="card-head">
          <div><h3 id="pastSeasonHeading">2025 season</h3><div class="sub">Public-results archive</div></div>
          <div id="pastSeasonSources" class="past-source-links"></div>
        </div>
        <div id="pastSeasonNote" class="insight past-season-note"></div>
      </div>
      <div class="card">
        <div class="past-season-filters">
          <div class="field"><label>Division</label><select id="pastSeasonGroup"></select></div>
          <div class="field"><label>Search athlete</label><input id="pastSeasonSearch" autocomplete="off" placeholder="Type a name"></div>
          <label class="pill" style="height:42px;justify-content:flex-start"><input id="pastSeasonCurrentOnly" type="checkbox"> Current roster matches only</label>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Season roster and records</h3><div class="sub" id="pastSeasonCount"></div></div></div>
        <div class="table-wrap">
          <table class="table past-roster-table">
            <thead><tr><th>Athlete</th><th>Division</th><th>Published mark</th><th>Meet / record</th><th>Source</th><th>2026 match</th></tr></thead>
            <tbody id="pastSeasonRoster"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Current-roster cross-reference</h3><div class="sub">Exact and likely name matches against the selected historical season</div></div></div>
        <div id="pastSeasonCrossReference" class="list"></div>
      </div>
    `;
    settings?.parentElement?.insertBefore(section, settings);
  }

  function openPastSeasons() {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'pastSeasons'));
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'pastSeasons'));
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = 'Past Seasons';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    const season = seasons[selectedYear];
    if (!season) return;

    const tabs = document.getElementById('pastSeasonTabs');
    tabs.innerHTML = Object.keys(seasons).sort((a, b) => Number(b) - Number(a)).map((year) =>
      `<button type="button" class="past-season-tab ${year === selectedYear ? 'active' : ''}" data-past-year="${year}">${year}</button>`
    ).join('');

    const groups = ['All', ...new Set(season.roster.map((row) => row.group))];
    const groupSelect = document.getElementById('pastSeasonGroup');
    groupSelect.innerHTML = groups.map((group) => `<option value="${esc(group)}">${esc(group)}</option>`).join('');
    if (!groups.includes(selectedGroup)) selectedGroup = 'All';
    groupSelect.value = selectedGroup;

    const activeNames = activeRosterNames();
    const matches = season.roster.filter((row) => row.current);
    const exact = matches.filter((row) => row.confidence === 'exact').length;
    const likely = matches.filter((row) => row.confidence === 'likely').length;
    const results = season.roster.filter((row) => row.time).length;

    document.getElementById('pastSeasonKpis').innerHTML = `
      <div class="kpi"><div class="label">Observed roster</div><div class="value">${season.roster.length}</div><div class="meta">Unique names in selected public records</div></div>
      <div class="kpi"><div class="label">Published marks</div><div class="value">${results}</div><div class="meta">Entries without finishes remain labeled as entries</div></div>
      <div class="kpi"><div class="label">Current roster matches</div><div class="value">${exact + likely}</div><div class="meta">${exact} exact • ${likely} likely spelling/name matches</div></div>
    `;

    document.getElementById('pastSeasonHeading').textContent = `${selectedYear} season`;
    document.getElementById('pastSeasonSources').innerHTML = season.sources.map(([label, url]) =>
      `<a class="past-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`
    ).join('');
    document.getElementById('pastSeasonNote').innerHTML = `<strong>Coverage note</strong><p>${esc(season.note)} This is a reconstruction from public meet records, not an official eligibility roster.</p>`;

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = season.roster
      .filter((row) => selectedGroup === 'All' || row.group === selectedGroup)
      .filter((row) => !currentOnly || row.current)
      .filter((row) => !normalizedQuery || row.name.toLowerCase().includes(normalizedQuery) || row.current.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));

    document.getElementById('pastSeasonCount').textContent = `${filtered.length} of ${season.roster.length} archived athletes shown`;
    document.getElementById('pastSeasonRoster').innerHTML = filtered.length ? filtered.map((row) => {
      const match = row.current
        ? `<span class="pill ${row.confidence === 'exact' ? 'past-match-exact' : 'past-match-likely'}">${esc(row.current)} • ${esc(row.confidence)}</span>`
        : '<span class="muted">—</span>';
      return `<tr>
        <td><strong>${esc(row.name)}</strong><div class="meta">${esc(row.status)}</div></td>
        <td>${esc(row.group)}</td>
        <td><strong>${esc(row.time || '—')}</strong></td>
        <td>${esc(row.meet || 'Public entry')}</td>
        <td>${esc(row.source)}</td>
        <td>${match}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty">No archived athletes match these filters.</div></td></tr>';

    const matchedCurrent = new Set(matches.map((row) => row.current.toLowerCase()));
    const notFound = activeNames.filter((name) => !matchedCurrent.has(name.toLowerCase()));
    const matchRows = matches.sort((a, b) => a.current.localeCompare(b.current)).map((row) =>
      `<div class="list-item"><div><div class="name">${esc(row.current)}</div><div class="meta">Historical record: ${esc(row.name)} • ${esc(row.group)}</div></div><span class="pill ${row.confidence === 'exact' ? 'past-match-exact' : 'past-match-likely'}">${esc(row.confidence)}</span></div>`
    ).join('');
    const missing = notFound.length
      ? `<div class="insight"><strong>Not found in the selected public sources</strong><p>${notFound.map(esc).join(' • ')}</p></div>`
      : '<div class="insight"><strong>Every active athlete matched</strong><p>No unmatched current athletes for this season.</p></div>';
    document.getElementById('pastSeasonCrossReference').innerHTML = matchRows || '<div class="empty">No current-roster matches in this season.</div>';
    document.getElementById('pastSeasonCrossReference').insertAdjacentHTML('beforeend', missing);
  }

  function bind() {
    document.addEventListener('click', (event) => {
      const nav = event.target.closest('[data-past-seasons-nav], #openPastSeasonsBtn');
      if (nav) {
        event.preventDefault();
        openPastSeasons();
        return;
      }
      const year = event.target.closest('[data-past-year]');
      if (year) {
        selectedYear = year.dataset.pastYear;
        selectedGroup = 'All';
        render();
      }
    });

    document.getElementById('pastSeasonGroup')?.addEventListener('change', (event) => {
      selectedGroup = event.target.value;
      render();
    });
    document.getElementById('pastSeasonSearch')?.addEventListener('input', (event) => {
      query = event.target.value;
      render();
      const input = document.getElementById('pastSeasonSearch');
      input.value = query;
      input.focus();
    });
    document.getElementById('pastSeasonCurrentOnly')?.addEventListener('change', (event) => {
      currentOnly = event.target.checked;
      render();
      document.getElementById('pastSeasonCurrentOnly').checked = currentOnly;
    });
  }

  function install() {
    injectStyles();
    injectNavigation();
    injectView();
    bind();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();