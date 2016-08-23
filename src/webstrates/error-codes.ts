class WebstratesErrorCodes {

  public static AccessForbidden = {
    code: 403,
    errorTemplate: (id) => {
      return `Access to ${id} forbidden`
    }
  }

  public static WebstrateNotFound = {
    code: 404,
    errorTemplate: (id) => {
      return `Webstrate ${id} doesn't exist on server, creating it.`
    }
  }

  public static InternalServerError = {
    code: 500,
    errorTemplate: () => {
      return `Internal Server Error`
    }
  }
}

export { WebstratesErrorCodes }