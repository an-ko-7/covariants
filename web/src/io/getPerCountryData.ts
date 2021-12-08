/* eslint-disable camelcase */
import copy from 'fast-copy'
import { pickBy } from 'lodash'

import { getEnabledCountriesNames, getPlaces, Places } from 'src/io/getPlaces'
import perCountryDataJson from 'src/../data/perCountryData.json'
import { loadAll } from 'js-yaml'

export interface PerCountryDatum {
  cluster_names: string[]
  distributions: CountryDistribution[]
  max_date: string
  min_date: string
  region: string
  per_country_intro_content: string
}

export interface PerCountryDataRaw {
  regions: PerCountryDatum[]
}

export interface CountryDistributionDatum {
  week: string
  total_sequences: number
  cluster_counts: {
    [key: string]: number | undefined
  }
}

export interface CountryDistribution {
  country: string
  distribution: CountryDistributionDatum[]
}

export interface ClusterState {
  [key: string]: { enabled: boolean }
}

export interface PerCountryData {
  clusterNames: string[]
  clusters: ClusterState
  places: Places
  countryDistributions: CountryDistribution[]
  perCountryIntroContent: string
  regionName: string
}

export function getPerCountryDataRaw(): PerCountryDataRaw {
  return perCountryDataJson as PerCountryDataRaw
}

// export function getPerCountryData(regionName: string): PerCountryData {
//   const allData = getPerCountryDataRaw()

//   const perCountryData: PerCountryDatum | undefined = allData.regions.find(
//     (candidate) => candidate.region === regionName,
//   )
//   if (!perCountryData) {
//     throw new Error(`Region data not found for region: ${regionName}`)
//   }

//   const clusterNames = copy(perCountryData.cluster_names).sort()
//   const clusters = clusterNames.reduce((result, cluster) => {
//     return { ...result, [cluster]: { enabled: true } }
//   }, {})

//   const countriesListRaw = perCountryData.distributions.map(({ country }) => ({ countryName: country, enabled: true }))
//   const places = getPlaces(countriesListRaw, regionName)

//   const countryDistributions = perCountryData.distributions

//   const perCountryIntroContent = perCountryData.per_country_intro_content

//   return {
//     clusterNames,
//     clusters,
//     places,
//     countryDistributions,
//     perCountryIntroContent,
//   }
// }

export function getPerCountryDataExtended(regionName: string, countries: string[]): PerCountryData {

  let loadAllCountries = (countries[0].toUpperCase()==='all'.toUpperCase()) ? true : false
  const allData = getPerCountryDataRaw()
  
  let perCountryData = allData.regions.find(
    (candidate) => (candidate.region === regionName) && 
      (countries.every(country => candidate.distributions
        .filter(e => e.country === country).length > 0) || loadAllCountries),
  )

  if(!perCountryData)
  {
    regionName='World'
    loadAllCountries=true

    perCountryData = allData.regions.find(
      (candidate) => candidate.region === regionName && 
        (countries.every(country => candidate.distributions
          .filter(e => e.country === country).length > 0) || loadAllCountries),
    )

    if (!perCountryData) {
      throw new Error(`Region data not found for the region ${regionName}, or the requested countries do not correspond with the region.`)
    }
  }

  const clusterNames = copy(perCountryData.cluster_names).sort()
  const clusters = clusterNames.reduce((result, cluster) => {
    return { ...result, [cluster]: { enabled: true } }
  }, {})

  const countriesListRaw = perCountryData.distributions
    .map(({ country }) => (
      countries.includes(country) || loadAllCountries 
        ? { countryName: country, enabled: true } 
        : { countryName: country, enabled: false }
    ))

  const places = getPlaces(countriesListRaw, regionName)

  const countryDistributions = perCountryData.distributions

  const perCountryIntroContent = perCountryData.per_country_intro_content

  return {
    clusterNames,
    clusters,
    places,
    countryDistributions,
    perCountryIntroContent,
    regionName
  }
}

export function getPerCountryIntroContentFilename(region: string): string {
  const allData = getPerCountryDataRaw()
  const perCountryData: PerCountryDatum | undefined = allData.regions.find((candidate) => candidate.region === region)
  if (!perCountryData) {
    throw new Error(`Region data not found for region: ${region}`)
  }
  return perCountryData.per_country_intro_content
}

export function getRegions() {
  const allData = getPerCountryDataRaw()
  const regionNames = allData.regions.map(({ region }) => region)
  const regionsHaveData = allData.regions.map(
    ({ cluster_names, distributions }) => cluster_names.length > 0 && distributions.length > 0,
  )
  const defaultRegionName = regionNames[0]

  return {
    regionNames,
    regionsHaveData,
    defaultRegionName,
  }
}

export function filterCountries(places: Places, countryDistributions: CountryDistribution[]) {
  const enabledCountries = getEnabledCountriesNames(places)
  const withCountriesFiltered = countryDistributions.filter(({ country }) => {
    return enabledCountries.has(country)
  })
  return { enabledCountries, withCountriesFiltered }
}

export function filterClusters(clusters: ClusterState, withCountriesFiltered: CountryDistribution[]) {
  const enabledClusters = Object.entries(clusters)
    .filter(([_0, { enabled }]) => enabled)
    .map(([cluster]) => cluster)

  const withClustersFiltered = withCountriesFiltered.map(({ country, distribution }) => {
    const distributionFiltered = distribution.map((dist) => {
      const countsFiltered = pickBy(dist.cluster_counts, (_0, cluster) => {
        return enabledClusters.some((candidate) => candidate === cluster)
      })

      return { ...dist, cluster_counts: countsFiltered }
    })
    return { country, distribution: distributionFiltered }
  })

  return { enabledClusters, withClustersFiltered }
}

export function toggleCluster(oldClusters: ClusterState, clusterName: string): ClusterState {
  return { ...oldClusters, [clusterName]: { ...oldClusters[clusterName], enabled: !oldClusters[clusterName].enabled } }
}
