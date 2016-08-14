class WebstratesErrorCodes {
  public static WebstrateNotFound = {
    code: 404,
    errorTemplate: (id) => {
      return `Webstrate ${id} doesn't exist on server, creating it.`
    }
  }
}

export { WebstratesErrorCodes }